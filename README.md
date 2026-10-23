# LandAudit AI

React + Vite + TypeScript front end, **Supabase** back end (auth, Postgres, file storage). Everything used here has a free tier.

## Run locally
```bash
npm install
cp .env.example .env.local      # already holds the project URL and the public (publishable) key
npm run dev                     # http://localhost:5173
npm run build                   # type-check + production build
```

## Structure
```
src/lib/supabase.ts   Supabase client (PKCE auth)
src/api.ts            the ONLY file pages call for data: auth, cases, documents, audit, admin
src/data.ts           database row <-> app model mappers + hydrate() that loads a user's data
src/store.ts          in-memory cache the pages read (language + theme only in localStorage)
src/engine.ts         audit rules, score, claim checks (runs in the browser)
src/pages/            Auth (login, register + email code, forgot/reset), Dashboard, NewCase, Case, Plans, Admin
src/components/       Shell, MapView (Leaflet: search, GPS, live follow, draggable pin)
supabase/schema.sql   full database + security rules (already applied to the live project)
```

## Security model (Row Level Security)
- A user can only read and write **their own** cases, documents, reviews and files (`<user-id>/<case-id>/...` in the private `documents` bucket).
- Admins (profiles.role = 'admin') can read everything and manage users, reviews and score rules.
- Users cannot change their own role, plan, credits or status (database trigger). Credits are spent only inside the `run_audit` database function.
- Share links work through `get_shared_case(token)`, which returns a case only while its owner has sharing ON.

## Make the first admin
Register normally, then in Supabase SQL Editor:
```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

## Before real clients
1. **Email**: Auth > Emails > Templates > "Confirm signup": put `{{ .Token }}` in the body so users get the 6-digit code.
2. **SMTP**: Auth > SMTP Settings: connect Resend or Brevo (free). Supabase's built-in mailer allows only ~2-3 emails/hour.
3. **URLs**: Auth > URL Configuration: set Site URL and Redirect URLs to your Vercel domain.
4. Vercel > Environment Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
5. Auth > Providers > Email > turn on "Leaked password protection" (Pro plan feature) when you upgrade.

## Features added for launch
- **Plot boundary + area**: on a case's Location tab, draw the plot on the satellite map. Area is shown in sq ft, cents, grounds and acres, and flagged if it differs from the declared extent by more than 10%.
- **DPDP consent record**: the register form needs an explicit tick; the accepted notice version is stored in `consents` (append-only). Bump `NOTICE_VERSION` in `src/api.ts` when the privacy notice changes.

## Map and map assistant
- **Map engine**: MapLibre GL + OpenFreeMap street style (free, no key, commercial use allowed). Satellite view uses Esri imagery with `VITE_ESRI_KEY`.
- **Map assistant** (`/map`, and the Location tab of every case): drop a pin, ask "hospitals within 3 km", "PG hostels nearby". The `map-chat` Edge Function reads OpenStreetMap (Overpass), computes distances, adds road distance from OSRM when reachable, and the AI only words the answer. Without `GROQ_API_KEY` it still answers with a plain template. Limits: 40 questions per user per hour.
- OpenStreetMap coverage of PG hostels in India is incomplete, and the data has no ratings. The assistant says so.

## Edge Functions (already deployed to the live project)
- `run-audit`: computes the audit on the server with the same `engine.ts` rules and charges the credit. Clients can no longer write `audit` or `paid` (database trigger).
- `extract-document`: reads an uploaded document with a vision model and returns the fields the audit compares. Provider = secret `OCR_PROVIDER` (`groq` default, or `anthropic`).
  - **Groq** (secret `GROQ_API_KEY`): model `qwen/qwen3.8-27b` (Groq Preview model; override with `GROQ_VISION_MODEL`). Groq reads images only, max 3 per request, so the browser renders PDF pages to JPEG first (`src/lib/pdfpages.ts`, first 3 + last 3 pages) and the function merges the batches, lowering confidence where batches disagree.
  - **Anthropic** (secret `ANTHROPIC_API_KEY`, optional `ANTHROPIC_MODEL`): reads PDFs directly.
  - Without a key, documents fall back to manual entry. Limit: 40 documents per user per hour.
- `ai-explain`: answers questions on the case page using only the audit findings and extracted values (never the raw files). Secret `GROQ_API_KEY`, model `openai/gpt-oss-120b` (Groq production model; override with `GROQ_TEXT_MODEL`). Limit: 30 questions per user per hour. Without a key the page uses its built-in rule-based answers.
- Groq retires models often (Llama 3.3 70B, Llama 4 Scout/Maverick are gone). If a function returns `MODEL_UNAVAILABLE`, pick a current model from https://console.groq.com/docs/models and set the secret; no redeploy needed.
- After editing `src/engine.ts`, run `scripts/sync-functions.sh` and redeploy `run-audit` (`supabase functions deploy run-audit`) so server and app rules stay identical.

## Still demo / next phases
- **Payments**: not connected. Admin adds credits. Wire Razorpay via an Edge Function that inserts into `payments` and adds credits.
- Government sources (EC, patta, FMB) are not connected.
