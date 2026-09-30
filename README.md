# Tamil Nadu AI Land Audit — Frontend Prototype

Evidence-first land audit interface (white theme). Everything runs in the browser.
No install, no build step, no backend.

## Files
- `index.html` — the main app (user screens + admin console, Phases 1–6)
- `prototypes/four-panel-flow.html` — single-screen 4-step flow styled like the reference image
- `prototypes/live-dashboard.html` — live-updating dashboard (simulated data)
- `serve.py` — optional tiny local server (needs Python 3)

## Run it (pick one)

### Option 1 — Double-click (simplest)
Open `index.html` in Chrome, Edge or Firefox.

### Option 2 — Local server (recommended)
Python 3:
    cd tn-land-audit
    python serve.py
Then open http://localhost:8000

Or with Node.js:
    cd tn-land-audit
    npx serve .

Or in VS Code: install "Live Server", right-click `index.html` → Open with Live Server.

## Notes
- Internet is only needed for the Google Fonts (Plus Jakarta Sans, Noto Sans Tamil).
  Offline, the page still works with fallback fonts; Tamil needs a Tamil-capable system font.
- All data is sample/demo data. Uploaded files are NOT read; OCR values, map data,
  scores and government-source statuses are fixed mock data. No government system is connected.
- Data lives in constants near the top of the script in `index.html`
  (CATS, FD, DOCS, EX, CMP, SRC, ASR, RULES, ...). Replace these with API calls
  when a backend exists.

## Try this
1. Landing → Start New Land Audit → any 10-digit mobile → Send OTP → any 6 digits.
2. Dashboard → Open on CASE-2026-001 (case workspace: Overview, Documents, Map, Verification, Findings, AI, Report).
3. Sidebar bottom → "Admin console (demo)" for the admin screens.

## Next steps (not included)
React + TypeScript + Vite + Tailwind port with typed models, a real map (Leaflet/MapLibre),
backend/OCR/GIS integration, and tests.
