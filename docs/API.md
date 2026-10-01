# Nilam API reference

Base URL: `http://localhost:8080/api` · Interactive docs (Swagger): **`/api/docs`** · OpenAPI JSON: `/api/openapi.json`

- **Auth:** none for now. Every request runs as the default user; all data is scoped by `owner_id`, so real login drops in at `backend/app/auth.py` without touching routes.
- **Errors:** always `{"error": "message"}` with a proper status (400/404/413/415/422/429/502/503).
- **Rate limit:** 300 req/min per IP; chat 20/min.
- **IDs:** UUID strings.

## Cases
| Method | Path | What it does |
|---|---|---|
| GET | `/cases` | List my audits with score, coverage %, document count, open findings |
| POST | `/cases` | Create an audit `{title, district, village, survey_no}` -> full case |
| GET | `/cases/{id}` | Full case: documents, findings, score, location, nearby map data |
| DELETE | `/cases/{id}` | Permanently delete the case and its files (204) |
| POST | `/cases/{id}/analyze` | Re-run every rule (normally automatic) |
| PUT | `/cases/{id}/location` | `{lat, lng}` (inside Tamil Nadu). Fetches nearby hospitals/schools/bus/water from OpenStreetMap, re-runs rules |

## Documents
| Method | Path | What it does |
|---|---|---|
| POST | `/cases/{id}/documents` | `multipart/form-data`: `type` + `file` (PDF/JPG/PNG, max 15 MB). Returns **202**; extraction runs in the background, `status` goes `processing -> extracted / needs_ocr / failed`. Poll `GET /cases/{id}` |
| GET | `/documents/{id}/file` | View the original file |
| PUT | `/documents/{id}/fields` | Save corrected / confirmed fields `{fields:[{key,label,value,confirmed}]}`, rules re-run |
| DELETE | `/documents/{id}` | Delete file + record (204) |

`type` is one of: `sale_deed parent_deed ec patta tslr fmb a_register approval tax other`.
Field keys: `owner survey_no extent village doc_no reg_date approval_ref`.
File type is detected from the file's bytes, not the extension or declared type.

## Findings
| Method | Path | What it does |
|---|---|---|
| PATCH | `/findings/{id}` | `{status: open|reviewed|dismissed, note?}`. Your review survives later re-analysis |

Finding codes: `MISSING_DOC OWNER_MISMATCH SURVEY_MISMATCH SURVEY_VS_CASE EXTENT_DIFF APPROVAL_UNVERIFIED VILLAGE_MISMATCH DOC_UNREADABLE UNCONFIRMED_FIELDS WATERBODY_NEAR`.
Severity: `red` (high risk) · `amber` (needs review) · `info`.

## Map
| Method | Path | What it does |
|---|---|---|
| GET | `/geo/search?q=` | Place search in India (OSM Nominatim) -> `[{name, lat, lng}]` |

## AI assistant
| Method | Path | What it does |
|---|---|---|
| GET | `/cases/{id}/messages` | Chat history |
| POST | `/cases/{id}/chat` | `{message}` -> `{role, content}`. 503 if `ANTHROPIC_API_KEY` unset. Answers only from the case's evidence |

## System
| GET | `/sources` | Honest status of each data source (live / not_configured / not_connected) |
|---|---|---|
| GET | `/health` | `{ok: true}` |

## Score object
```json
{"overall": 63, "coverage": 45, "categories": [{"id":"legal","name":"Legal Identity & Title","weight":20,"score":70,"assessed":true}, ...]}
```
`overall` is weighted over **assessed** categories only; `coverage` is the % of the framework with evidence.

## Example
```bash
curl -X POST localhost:8080/api/cases -H 'content-type: application/json' \
  -d '{"title":"Plot Nagapattinam","district":"Nagapattinam","village":"Nagapattinam","survey_no":"124/3A"}'
curl -F type=sale_deed -F file=@deed.pdf localhost:8080/api/cases/<id>/documents
curl localhost:8080/api/cases/<id>
```
