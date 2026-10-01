from app.services.extract import extent_to_sqft, parse_fields
from app.services.rules import evaluate, score, similarity

CASE = {"survey_no": "124/3A", "village": "Nagapattinam"}


def doc(t, fields, status="extracted"):
    return {"id": t, "type": t, "status": status, "fields": [{"key": k, "label": k, "value": v, "sqft": s, "confirmed": True} for k, v, s in fields]}


def codes(f):
    return {x["code"] for x in f}


def test_name_similarity_ignores_initials():
    assert similarity("Ramesh Kumar", "Ramesh Kumar S") >= 0.9
    assert similarity("Ramesh Kumar", "Suresh Babu") < 0.9


def test_units():
    assert extent_to_sqft("1", "cent") == 435.6
    assert extent_to_sqft("1", "ground") == 2400
    assert extent_to_sqft("1,200", "sq.ft") == 1200


def test_parse_english_deed():
    f = parse_fields("Vendor: Ramesh Kumar\nS.No. 124/3A\nExtent: 2,400 sq.ft\nDoc. No. 3187/2021", None)
    assert {x["key"] for x in f} >= {"owner", "survey_no", "extent", "doc_no"}
    assert all(x["confirmed"] is False for x in f)


def test_extent_tolerance():
    a = evaluate(CASE, [doc("sale_deed", [("extent", "2400 sq.ft", 2400)]), doc("patta", [("extent", "2385 sq.ft", 2385)])], None)
    assert "EXTENT_DIFF" in codes(a)
    b = evaluate(CASE, [doc("sale_deed", [("extent", "2400 sq.ft", 2400)]), doc("patta", [("extent", "2395 sq.ft", 2395)])], None)
    assert "EXTENT_DIFF" not in codes(b)


def test_core_findings():
    f = evaluate(CASE, [doc("sale_deed", [("survey_no", "124/3A", None), ("approval_ref", "DTCP/LO No. 1/2019", None)]), doc("patta", [("survey_no", "124/3", None)])], None)
    assert {"SURVEY_MISMATCH", "MISSING_DOC", "APPROVAL_UNVERIFIED"} <= codes(f)


def test_duplicate_approval_refs_do_not_collide():
    d = [doc("sale_deed", [("approval_ref", "DTCP/LO No. 1/2019", None)]), doc("approval", [("approval_ref", "DTCP/LO No. 1/2019", None)])]
    keys = [x["key"] for x in evaluate(CASE, d, None)]
    assert len(keys) == len(set(keys))


def test_score_excludes_unassessed():
    s = score([], [], None)
    assert s["coverage"] == 5 and s["overall"] == 100
    assert sum(c["assessed"] for c in s["categories"]) == 1
