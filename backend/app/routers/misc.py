from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import User, current_user
from ..config import settings
from ..db import get_db
from ..deps import audit, case_out, owned_case
from ..ratelimit import RateLimit
from ..services import ai
from ..services.geo import GeoError, search_place
from ..services.rules import analyze

router = APIRouter()


@router.patch("/findings/{finding_id}", response_model=schemas.CaseOut, tags=["Findings"], summary="Mark a finding reviewed / dismissed / reopened")
def review_finding(finding_id: str, body: schemas.FindingPatch, db: Session = Depends(get_db), user: User = Depends(current_user)):
    f = db.get(models.Finding, finding_id)
    case = db.get(models.Case, f.case_id) if f else None
    if not case or case.owner_id != user.id:
        raise HTTPException(404, "Not found")
    f.status, f.note = body.status, body.note
    audit(db, user, f"finding.{body.status}", f.id)
    db.commit()
    db.refresh(case)
    return case_out(case)


@router.get("/geo/search", response_model=list[schemas.PlaceOut], tags=["Map"], summary="Search a place in India (OpenStreetMap Nominatim)")
def geo_search(q: str = Query(min_length=3, max_length=150), _: User = Depends(current_user)):
    try:
        return list(search_place(q.strip()))
    except GeoError as e:
        raise HTTPException(502, str(e))


@router.get("/cases/{case_id}/messages", response_model=list[schemas.MessageOut], tags=["AI Assistant"], summary="Chat history for a case")
def messages(case: models.Case = Depends(owned_case)):
    return case.messages


@router.post("/cases/{case_id}/chat", response_model=schemas.MessageOut, tags=["AI Assistant"], summary="Ask the AI about this case", dependencies=[Depends(RateLimit(20))])
def chat(body: schemas.ChatIn, case: models.Case = Depends(owned_case), db: Session = Depends(get_db), user: User = Depends(current_user)):
    if not ai.configured():
        raise HTTPException(503, "AI assistant is not configured. Set ANTHROPIC_API_KEY on the server.")
    case.messages.append(models.Message(role="user", content=body.message))
    db.commit()
    history = [{"role": m.role, "content": m.content} for m in case.messages]
    try:
        reply = ai.chat(case_out(case).model_dump(mode="json"), history)
    except ai.AIError as e:
        raise HTTPException(502, str(e))
    case.messages.append(models.Message(role="assistant", content=reply))
    db.commit()
    return schemas.MessageOut(role="assistant", content=reply)


@router.get("/sources", response_model=list[schemas.SourceOut], tags=["System"], summary="Honest status of every data source")
def sources():
    on = ai.configured()
    return [
        {"name": "Uploaded documents (PDF / image OCR)", "status": "live", "note": "Text PDFs, scanned PDFs and images (English + Tamil OCR)."},
        {"name": "OpenStreetMap (map, search, nearby)", "status": "live", "note": "Free public services; fine for pilots, use a paid provider for scale."},
        {"name": "AI assistant (Anthropic)", "status": "live" if on else "not_configured", "note": "Answers only from case evidence." if on else "Set ANTHROPIC_API_KEY."},
        {"name": "TNREGINET (EC, registered deeds)", "status": "not_connected", "note": "Needs government permission / API agreement."},
        {"name": "DTCP / CMDA approvals", "status": "not_connected", "note": 'Approval references stay "unverified" until connected.'},
        {"name": "TNGIS / flood / groundwater / CRZ layers", "status": "not_connected", "note": "Environment score covers OSM waterbodies only."},
    ]
