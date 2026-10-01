from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import User, current_user
from ..config import settings
from ..db import get_db
from ..deps import audit, case_out, owned_case
from ..services import rules
from ..services.geo import GeoError, nearby
from fastapi import HTTPException

router = APIRouter(prefix="/cases", tags=["Cases"])


@router.get("", response_model=list[schemas.CaseRow], summary="List my audits")
def list_cases(db: Session = Depends(get_db), user: User = Depends(current_user)):
    rows = db.scalars(select(models.Case).where(models.Case.owner_id == user.id).order_by(models.Case.updated_at.desc())).all()
    out = []
    for c in rows:
        s = rules.score(rules.doc_dicts(c), rules.finding_dicts(c), c.geo)
        out.append(schemas.CaseRow(
            id=c.id, title=c.title, district=c.district, village=c.village, survey_no=c.survey_no, updated_at=c.updated_at,
            score=s["overall"], coverage=s["coverage"], docs=len(c.documents),
            open_findings=sum(1 for f in c.findings if f.status == "open" and f.severity != "info"),
        ))
    return out


@router.post("", response_model=schemas.CaseOut, status_code=201, summary="Create an audit")
def create_case(body: schemas.CaseIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    case = models.Case(owner_id=user.id, **body.model_dump())
    db.add(case)
    db.commit()
    rules.analyze(db, case)
    audit(db, user, "case.create", case.id)
    db.commit()
    return case_out(case)


@router.get("/{case_id}", response_model=schemas.CaseOut, summary="Get one audit with documents, findings and score")
def get_case(case: models.Case = Depends(owned_case)):
    return case_out(case)


@router.delete("/{case_id}", status_code=204, summary="Delete an audit and its files permanently")
def delete_case(case: models.Case = Depends(owned_case), db: Session = Depends(get_db), user: User = Depends(current_user)):
    for d in case.documents:
        (settings.upload_dir / d.stored_name).unlink(missing_ok=True)
    audit(db, user, "case.delete", case.id)
    db.delete(case)
    db.commit()
    return Response(status_code=204)


@router.post("/{case_id}/analyze", response_model=schemas.CaseOut, summary="Re-run all rules")
def analyze_case(case: models.Case = Depends(owned_case), db: Session = Depends(get_db), user: User = Depends(current_user)):
    rules.analyze(db, case)
    audit(db, user, "case.analyze", case.id)
    db.commit()
    return case_out(case)


@router.put("/{case_id}/location", response_model=schemas.CaseOut, summary="Set plot location, fetch nearby map data, re-run rules")
def set_location(body: schemas.LocationIn, case: models.Case = Depends(owned_case), db: Session = Depends(get_db), user: User = Depends(current_user)):
    try:
        geo = nearby(body.lat, body.lng)
    except GeoError as e:
        raise HTTPException(502, str(e))
    case.lat, case.lng, case.geo = body.lat, body.lng, geo
    rules.analyze(db, case)
    audit(db, user, "case.location", case.id)
    db.commit()
    return case_out(case)
