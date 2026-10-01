from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from . import models, schemas
from .auth import User, current_user
from .db import get_db
from .services import rules


def audit(db: Session, user: User, action: str, target: str | None = None) -> None:
    db.add(models.AuditLog(user_id=user.id, action=action, target=target))


def owned_case(case_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)) -> models.Case:
    case = db.get(models.Case, case_id)
    if not case or case.owner_id != user.id:  # same 404 for "missing" and "not yours": no information leak
        raise HTTPException(404, "Not found")
    return case


def owned_document(doc_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)) -> models.Document:
    doc = db.get(models.Document, doc_id)
    if not doc or db.get(models.Case, doc.case_id).owner_id != user.id:
        raise HTTPException(404, "Not found")
    return doc


_ORDER = {"red": 0, "amber": 1, "info": 2}


def case_out(case: models.Case) -> schemas.CaseOut:
    docs = [schemas.DocumentOut.model_validate(d) for d in case.documents]
    findings = sorted((schemas.FindingOut.model_validate(f) for f in case.findings), key=lambda f: _ORDER[f.severity])
    sc = rules.score(rules.doc_dicts(case), rules.finding_dicts(case), case.geo)
    return schemas.CaseOut(
        id=case.id, title=case.title, district=case.district, village=case.village, survey_no=case.survey_no,
        lat=case.lat, lng=case.lng, geo=case.geo, created_at=case.created_at, updated_at=case.updated_at,
        documents=docs, findings=findings, score=schemas.ScoreOut(**sc),
    )
