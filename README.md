# Nilam — Tamil Nadu Land Audit (real application)

React + Tailwind frontend, Node/Express API, SQLite database, real uploads, OCR, rule engine, map and AI assistant.
The original HTML prototype is kept in `prototype/` for reference only.

## Run
    npm install
    cp server/.env.example server/.env     # add ANTHROPIC_API_KEY for the AI assistant
    npm run dev                             # web: http://localhost:5173  api: :8080
Production: `npm run build && NODE_ENV=production npm start` (API serves the built web app on :8080).
Tests: `npm test -w server`.

## What is real
- Upload PDF/JPG/PNG -> text extraction (pdf-parse) or OCR (Tesseract, English+Tamil) -> candidate fields -> **you confirm/correct**.
- Rule engine (`server/src/rules.js`): owner-name fuzzy match, survey/sub-division match, extent tolerance 0.5% with unit conversion, missing documents, unverified approvals. Every finding carries its evidence.
- Score covers only categories that have evidence; the UI always shows the % of framework assessed.
- Map: OpenStreetMap tiles, Nominatim search, Overpass nearby (hospital, school, bus, waterbodies).
- AI assistant: Claude, answers only from the case's evidence; needs `ANTHROPIC_API_KEY`.
- Data is per-user scoped (`owner_id`), all inputs validated (zod), uploads type/size-limited, rate limits, helmet/CSP, audit log.

## Not connected (be honest in the product)
TNREGINET, DTCP, CMDA, TNGIS, flood/groundwater/CRZ layers need government access. Until then those items stay "unverified".

## Adding login later
Only `server/src/auth.js` changes (set `req.user` from a verified JWT/session). All queries already filter by `req.user.id`.
Before public launch also: HTTPS, move SQLite -> Postgres, move uploads -> S3 with encryption, backups, DPDP-Act consent + retention policy.
