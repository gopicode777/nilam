"""Audit rule engine. `evaluate` and `score` are pure functions (no DB) so they are trivially testable."""
import hashlib
import re
from difflib import SequenceMatcher

from sqlalchemy.orm import Session

from .. import models
from .extract import norm_survey

# (id, name, weight). A category only counts once there is evidence to assess it.
CATEGORIES = [
    ("legal", "Legal Identity & Title", 20), ("revenue", "Revenue & Survey", 20), ("planning", "Planning & Approvals", 15),
    ("access", "Access & Physical Condition", 10), ("environment", "Environment & Resilience", 10),
    ("neighbourhood", "Neighbourhood & Utilities", 10), ("market", "Market & Price", 10), ("evidence", "Evidence Quality", 5),
]
DOC_TYPES = {
    "sale_deed": "Sale Deed", "parent_deed": "Parent Deed", "ec": "Encumbrance Certificate", "patta": "Patta / Chitta",
    "tslr": "TSLR", "fmb": "FMB / Survey Sketch", "a_register": "A-Register", "approval": "Approval Documents",
    "tax": "Tax / Utility Records", "other": "Other",
}
REQUIRED = [("sale_deed", "legal", "red"), ("ec", "legal", "red"), ("patta", "revenue", "red"), ("fmb", "revenue", "amber")]
PENALTY = {"red": 30, "amber": 12, "info": 0}
EXTENT_TOLERANCE_PCT = 0.5
OWNER_MATCH = 0.9


def _norm_name(s: str) -> str:
    s = re.sub(r"\b(?:mr|mrs|ms|shri|thiru|tmt)\b\.?|\b[sdw]/o\b", "", s.lower())
    s = re.sub(r"\b[a-z]\b\.?", "", s)
    return re.sub(r"\s+", " ", re.sub(r"[^a-z ]", "", s)).strip()


def similarity(a: str, b: str) -> float:
    a, b = _norm_name(a), _norm_name(b)
    if not a or not b:
        return 0.0
    return 1.0 if a == b else SequenceMatcher(None, a, b).ratio()


def _h(s: str) -> str:
    return hashlib.sha1(s.encode()).hexdigest()[:10]


def evaluate(case: dict, docs: list[dict], geo: dict | None) -> list[dict]:
    """case: {survey_no, village}; docs: [{id,type,status,fields:[...]}]"""
    out: dict[str, dict] = {}

    def add(code, category, severity, title, detail, evidence=None, action=None, salt=""):
        key = f"{code}:{_h(salt or title)}"
        out.setdefault(key, dict(key=key, code=code, category=category, severity=severity, title=title, detail=detail, evidence=evidence or [], action=action))

    have = {d["type"] for d in docs}
    for t, cat, sev in REQUIRED:
        if t not in have:
            add("MISSING_DOC", cat, sev, f"{DOC_TYPES[t]} not uploaded", f"No {DOC_TYPES[t]} is attached to this case, so related checks could not run.", action=f"Obtain and upload the {DOC_TYPES[t]}.", salt=t)

    def vals(key):
        return [(DOC_TYPES.get(d["type"], d["type"]), f) for d in docs for f in d["fields"] if f["key"] == key and f.get("value")]

    ev = lambda arr: [{"document": n, "value": f["value"], "snippet": f.get("snippet")} for n, f in arr]  # noqa: E731

    owners = vals("owner")
    if len(owners) >= 2:
        ref = owners[0]
        bad = [o for o in owners if similarity(o[1]["value"], ref[1]["value"]) < OWNER_MATCH]
        if bad:
            others = ", ".join(f'"{f["value"]}" ({n})' for n, f in bad)
            add("OWNER_MISMATCH", "legal", "red", "Owner name differs between documents", f'"{ref[1]["value"]}" ({ref[0]}) does not match {others} at the {int(OWNER_MATCH * 100)}% threshold.', ev(owners), "Ask the seller to explain and provide supporting name-change / legal-heir documents.")

    surveys = vals("survey_no")
    distinct = sorted({norm_survey(f["value"]) for _, f in surveys})
    claimed = norm_survey(case["survey_no"])
    if len(distinct) > 1:
        add("SURVEY_MISMATCH", "revenue", "red", "Survey number differs between documents", f"Documents show different survey numbers: {', '.join(distinct)}.", ev(surveys), "Verify the correct survey / sub-division with the Taluk office.")
    elif len(distinct) == 1 and distinct[0] != claimed:
        add("SURVEY_VS_CASE", "revenue", "amber", "Documents disagree with the survey number entered for this case", f"Case says {case['survey_no']}; documents say {distinct[0]}.", ev(surveys), "Confirm which survey number is being purchased.")

    ext = [(DOC_TYPES.get(d["type"], d["type"]), f) for d in docs for f in d["fields"] if f["key"] == "extent" and f.get("sqft")]
    if len(ext) >= 2:
        lo, hi = min(f["sqft"] for _, f in ext), max(f["sqft"] for _, f in ext)
        pct = (hi - lo) / hi * 100
        if pct > EXTENT_TOLERANCE_PCT:
            add("EXTENT_DIFF", "revenue", "red" if pct > 5 else "amber", "Extent differs between documents", f"Extents differ by {hi - lo:.0f} sq.ft ({pct:.2f}%). Tolerance is {EXTENT_TOLERANCE_PCT}%.", ev(ext), "Get a licensed survey to establish the true extent.")

    for n, f in vals("approval_ref"):
        add("APPROVAL_UNVERIFIED", "planning", "amber", "Layout approval could not be verified", f"Reference {f['value']} appears in {n}. This is a claim; no official DTCP/CMDA source is connected, so it is not verified.", ev([(n, f)]), "Verify the approval directly with DTCP / CMDA.", salt=f["value"])

    if case.get("village"):
        off = [(n, f) for n, f in vals("village") if similarity(f["value"], case["village"]) < 0.8]
        if off:
            add("VILLAGE_MISMATCH", "revenue", "amber", "Village differs from case details", f"Case village is {case['village']}; " + ", ".join(f"{f['value']} ({n})" for n, f in off) + " found in documents.", ev(off))

    for d in docs:
        if d["status"] in ("needs_ocr", "failed") or (d["status"] == "extracted" and not d["fields"]):
            msg = "This looks like a scanned PDF that could not be OCR-ed. Upload page images (JPG/PNG)." if d["status"] == "needs_ocr" else "No recognisable fields were extracted. Review manually."
            add("DOC_UNREADABLE", "evidence", "amber", f"{DOC_TYPES.get(d['type'], d['type'])}: no fields could be read", msg, action="Upload a clearer copy, or enter the fields manually.", salt=d["id"])
    unconfirmed = sum(1 for d in docs for f in d["fields"] if not f.get("confirmed"))
    if unconfirmed:
        add("UNCONFIRMED_FIELDS", "evidence", "info", f"{unconfirmed} extracted field(s) not yet confirmed by you", "Extracted values are machine-read candidates. Confirm or correct them before relying on the results.", action="Open Documents and confirm each field.", salt="unconfirmed")

    if geo:
        water = sorted((i for i in geo["items"] if i["kind"] == "water" and i["distance"] <= 500), key=lambda i: i["distance"])
        if water:
            w = water[0]
            add("WATERBODY_NEAR", "environment", "amber", "Waterbody within 500 m", f"{w.get('name') or 'A waterbody'} is about {w['distance']} m from the plot (OpenStreetMap data).", action="Check flood history and setback rules with the local authority.")
    return list(out.values())


def score(docs: list[dict], findings: list[dict], geo: dict | None) -> dict:
    """Score only what has evidence; `coverage` = % of the framework actually assessed."""
    active = [f for f in findings if f["status"] != "dismissed"]
    assessed = {"evidence"}
    if docs:
        assessed |= {"legal", "revenue"}
    if any(d["type"] == "approval" for d in docs):
        assessed.add("planning")
    if geo:
        assessed |= {"environment", "neighbourhood"}
    cats = []
    for cid, name, weight in CATEGORIES:
        on = cid in assessed
        s = max(0, 100 - sum(PENALTY[f["severity"]] for f in active if f["category"] == cid)) if on else None
        cats.append({"id": cid, "name": name, "weight": weight, "score": s, "assessed": on})
    a = [c for c in cats if c["assessed"]]
    w = sum(c["weight"] for c in a)
    return {"overall": round(sum(c["score"] * c["weight"] for c in a) / w) if w else None, "coverage": w, "categories": cats}


# ---------- DB glue ----------
def doc_dicts(case: models.Case) -> list[dict]:
    return [{"id": d.id, "type": d.type, "status": d.status, "fields": d.fields or []} for d in case.documents]


def finding_dicts(case: models.Case) -> list[dict]:
    return [{"category": f.category, "severity": f.severity, "status": f.status} for f in case.findings]


def analyze(db: Session, case: models.Case) -> None:
    """Re-run all rules; keep the user's review status/notes for findings that still apply."""
    nxt = evaluate({"survey_no": case.survey_no, "village": case.village}, doc_dicts(case), case.geo)
    old = {f.key: (f.status, f.note) for f in case.findings}
    case.findings.clear()
    db.flush()
    for f in nxt:
        status, note = old.get(f["key"], ("open", None))
        case.findings.append(models.Finding(**f, status=status, note=note))
    db.commit()
    db.refresh(case)
