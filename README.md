# Nilam — Tamil Nadu Land Audit

Evidence-first land audit. **FastAPI (Python) + PostgreSQL/SQLite** backend, **React + TypeScript + Tailwind** frontend.

    nilam/
    ├─ backend/   FastAPI · SQLAlchemy 2 · pytest
    │  └─ app/    routers/ (HTTP) · services/ (OCR, rules, geo, AI) · models · schemas · auth (single seam)
    ├─ client/    React 18 · TypeScript · Vite · Tailwind · Leaflet
    ├─ docs/API.md   full API reference (live Swagger at /api/docs)
    └─ prototype/    original HTML prototype (reference only)

## Quick start
    make setup            # venv + pip + npm install, creates backend/.env
    # add ANTHROPIC_API_KEY in backend/.env for the AI assistant
    make api              # terminal 1 -> http://localhost:8080  (Swagger: /api/docs)
    make web              # terminal 2 -> http://localhost:5173
    make test
OCR needs system packages: `sudo apt install tesseract-ocr tesseract-ocr-tam poppler-utils`.

## Production (Docker + Postgres)
    cp backend/.env.example backend/.env && docker compose up --build   # http://localhost:8080

## What is real
Upload -> text/OCR (English+Tamil, scanned PDFs too) -> candidate fields -> **you confirm** -> rule engine (owner fuzzy match, survey/sub-division, extent tolerance with unit conversion, missing docs, unverified approvals) -> evidence-linked findings -> score that covers only what was assessed -> map checks (OpenStreetMap) -> AI Q&A grounded in the case -> printable report.

## Not connected (shown honestly in the app)
TNREGINET, DTCP, CMDA, TNGIS, flood/groundwater/CRZ layers need government access.

## Before public launch
Real login (`backend/app/auth.py`) · Alembic migrations (currently `create_all`) · S3-compatible encrypted storage for uploads · HTTPS · backups · DPDP-Act consent & retention policy · Redis rate limiting if >1 instance.
