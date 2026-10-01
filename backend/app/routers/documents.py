import re
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import User, current_user
from ..config import settings
from ..db import SessionLocal, get_db
from ..deps import audit, case_out, owned_case, owned_document
from ..services import rules
from ..services.extract import OcrUnavailable, extent_to_sqft, extract_text, parse_fields

router = APIRouter(tags=["Documents"])

# Trust the file's bytes, never the client-declared content type.
MAGIC = [(b"%PDF", "application/pdf", ".pdf"), (b"\xff\xd8\xff", "image/jpeg", ".jpg"), (b"\x89PNG\r\n\x1a\n", "image/png", ".png")]


def _sniff(head: bytes) -> tuple[str, str] | None:
    for magic, mime, ext in MAGIC:
        if head.startswith(magic):
            return mime, ext
    if not settings.production:  # plain text is accepted for testing only
        try:
            head.decode("utf-8")
            if all(b >= 32 or b in (9, 10, 13) for b in head):
                return "text/plain", ".txt"
        except UnicodeDecodeError:
            pass
    return None


def process_document(doc_id: str) -> None:
    """Background job: extract text -> parse fields -> re-run rules. Uses its own DB session."""
    with SessionLocal() as db:
        doc = db.get(models.Document, doc_id)
        if not doc:
            return
        try:
            text, conf, status = extract_text(settings.upload_dir / doc.stored_name, doc.mime)
            doc.text, doc.ocr_confidence, doc.status = text, conf, status
            doc.fields = parse_fields(text, conf) if text else []
        except OcrUnavailable as e:
            doc.status, doc.error = "failed", str(e)[:300]
        except Exception as e:  # noqa: BLE001 - a bad file must never crash the worker
            doc.status, doc.error = "failed", f"Could not read file: {type(e).__name__}"
        db.commit()
        rules.analyze(db, db.get(models.Case, doc.case_id))


@router.post("/cases/{case_id}/documents", response_model=schemas.CaseOut, status_code=202, summary="Upload a document (PDF/JPG/PNG)")
async def upload(
    background: BackgroundTasks, file: UploadFile, type: schemas.DocType = Form(...),
    case: models.Case = Depends(owned_case), db: Session = Depends(get_db), user: User = Depends(current_user),
):
    limit = settings.max_upload_mb * 1024 * 1024
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(413, f"File too large (max {settings.max_upload_mb} MB)")
    sniffed = _sniff(data[:16])
    if not sniffed:
        raise HTTPException(415, "Only PDF, JPG and PNG files are allowed")
    mime, ext = sniffed
    stored = f"{uuid.uuid4()}{ext}"
    (settings.upload_dir / stored).write_bytes(data)
    doc = models.Document(case_id=case.id, type=type, original_name=re.sub(r"[^\w.\- ()]", "_", file.filename or "file")[:200], stored_name=stored, mime=mime, size=len(data))
    db.add(doc)
    audit(db, user, "document.upload", doc.id)
    db.commit()
    background.add_task(process_document, doc.id)  # UI polls while status == "processing"
    db.refresh(case)
    return case_out(case)


@router.get("/documents/{doc_id}/file", summary="Download / view the original file")
def get_file(doc: models.Document = Depends(owned_document)):
    return FileResponse(settings.upload_dir / doc.stored_name, media_type=doc.mime, headers={"Content-Disposition": "inline"})


@router.put("/documents/{doc_id}/fields", response_model=schemas.CaseOut, summary="Save corrected / confirmed fields, then re-run rules")
def save_fields(body: schemas.FieldsIn, doc: models.Document = Depends(owned_document), db: Session = Depends(get_db), user: User = Depends(current_user)):
    clean = []
    for f in body.fields:
        if not f.value.strip():
            continue
        d = f.model_dump(exclude_none=True)
        if f.key == "extent":
            m = re.match(r"\s*([\d.,]+)\s*(.+)", f.value)
            d["sqft"] = extent_to_sqft(m.group(1), m.group(2)) if m else None
            if d["sqft"] is None:
                d.pop("sqft")
        clean.append(d)
    doc.fields = clean
    case = db.get(models.Case, doc.case_id)
    db.commit()
    rules.analyze(db, case)
    audit(db, user, "document.fields", doc.id)
    db.commit()
    return case_out(case)


@router.delete("/documents/{doc_id}", status_code=204, summary="Delete a document")
def delete_document(doc: models.Document = Depends(owned_document), db: Session = Depends(get_db), user: User = Depends(current_user)):
    (settings.upload_dir / doc.stored_name).unlink(missing_ok=True)
    case = db.get(models.Case, doc.case_id)
    db.delete(doc)
    db.commit()
    db.refresh(case)
    rules.analyze(db, case)
    audit(db, user, "document.delete", doc.id)
    db.commit()
    return Response(status_code=204)
