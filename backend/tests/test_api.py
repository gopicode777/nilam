import io

CASE = {"title": "Plot Nagapattinam", "district": "Nagapattinam", "village": "Nagapattinam", "survey_no": "124/3A"}
DEED = b"SALE DEED\nVendor: Ramesh Kumar\nVillage: Nagapattinam\nS.No. 124/3A\nExtent: 2400 sq.ft\nDoc. No. 3187/2021\nApproval Ref. DTCP/LO No. 0412/2019\n"
PATTA = b"PATTA\nPatta holder: Ramesh Kumar S\nVillage: Nagapattinam\nSurvey No: 124/3\nExtent: 2385 sq.ft\n"


def up(client, cid, typ, data):
    return client.post(f"/api/cases/{cid}/documents", data={"type": typ}, files={"file": ("x.txt", io.BytesIO(data), "text/plain")})


def test_full_flow(client):
    c = client.post("/api/cases", json=CASE).json()
    cid = c["id"]
    assert up(client, cid, "sale_deed", DEED).status_code == 202
    assert up(client, cid, "patta", PATTA).status_code == 202
    c = client.get(f"/api/cases/{cid}").json()
    assert [d["status"] for d in c["documents"]] == ["extracted", "extracted"]
    codes = {f["code"] for f in c["findings"]}
    assert {"SURVEY_MISMATCH", "EXTENT_DIFF", "APPROVAL_UNVERIFIED", "MISSING_DOC"} <= codes
    assert c["score"]["coverage"] == 45

    # confirming fields persists and review status survives re-analysis
    fid = next(f["id"] for f in c["findings"] if f["code"] == "EXTENT_DIFF")
    assert client.patch(f"/api/findings/{fid}", json={"status": "reviewed"}).status_code == 200
    d = c["documents"][0]
    r = client.put(f"/api/documents/{d['id']}/fields", json={"fields": [{**f, "confirmed": True} for f in d["fields"]]})
    assert r.status_code == 200
    again = next(f for f in r.json()["findings"] if f["code"] == "EXTENT_DIFF")
    assert again["status"] == "reviewed"

    assert client.delete(f"/api/cases/{cid}").status_code == 204
    assert client.get(f"/api/cases/{cid}").status_code == 404


def test_validation_and_errors(client):
    r = client.post("/api/cases", json={**CASE, "title": "x"})
    assert r.status_code == 422 and "error" in r.json()
    assert client.get("/api/cases/nope").json() == {"error": "Not found"}
    cid = client.post("/api/cases", json=CASE).json()["id"]
    bad = client.post(f"/api/cases/{cid}/documents", data={"type": "sale_deed"}, files={"file": ("a.pdf", io.BytesIO(b"\x00\x01\x02binary"), "application/pdf")})
    assert bad.status_code == 415  # declared PDF, but bytes are not
    assert client.post(f"/api/cases/{cid}/documents", data={"type": "bogus"}, files={"file": ("a.txt", io.BytesIO(DEED), "text/plain")}).status_code == 422


def test_chat_requires_key_and_sources(client):
    cid = client.post("/api/cases", json=CASE).json()["id"]
    assert client.post(f"/api/cases/{cid}/chat", json={"message": "hi"}).status_code == 503
    assert any(s["name"].startswith("TNREGINET") and s["status"] == "not_connected" for s in client.get("/api/sources").json())


def test_location_outside_tamil_nadu_rejected(client):
    cid = client.post("/api/cases", json=CASE).json()["id"]
    assert client.put(f"/api/cases/{cid}/location", json={"lat": 28.6, "lng": 77.2}).status_code == 422
