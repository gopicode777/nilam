# LandAudit AI: frontend base (no backend)

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
```
Needs internet: map tiles (OpenStreetMap, Esri) and nearby places (Overpass API) are live.

## Demo logins (any password with 8+ characters)
- Admin: `admin@landaudit.ai`
- User with data: `ravi@example.com`
- New user: Register, then any 6 digits on the OTP page.

## Pages
Public: `/` landing, `/pricing`, `/sample`, `/legal/terms|privacy|disclaimer`, `/share/:token`.
App: dashboard, new audit, compare plots, professionals, plans, settings.
Case tabs: overview, documents (with viewer), location, claims, audit, ownership chain, seller questions, assistant (voice input in Chrome), report, share (link + QR).
Admin: overview, users (click for detail), all cases, review queue, analytics, score rules editor, data sources, logs.

## Design and motion
Font: Geist (+ Geist Mono for evidence labels, Noto Sans Tamil). Floating pill nav and sidebar, 16-24px rounded cards, dark pill buttons with an arrow chip.
Motion: page fade out/in on route change, staggered rise of cards, rows and findings, count-up numbers, score ring and bars that fill when they scroll into view, scroll-reveal on the landing page, mouse-parallax floating cards in the hero, animated survey contour rings, smooth FAQ accordion, an analysis overlay when an audit runs, chart draw-in on admin.html. All of it switches off when the OS asks for reduced motion.

## Report download
Audit tab and Report tab: **Download PDF** builds an A4 report (score, status rows, key highlights with map, findings with evidence, ownership chain, claims, documents, actions) in English or Tamil, plus a findings CSV. It is generated in the browser (html2canvas + jsPDF), so Tamil text renders correctly. The map image needs internet.

## Admin page for clients
Sidebar > Admin analytics opens `public/admin.html`, a standalone page with charts on placeholder data (7/30/90 day switch, English/Tamil). Replace the generated data with API calls later.

## The flow (one case per property)
Add property → Documents (upload, extracted values with confidence, confirm or edit) → Location (live map data) →
Claims (broker says vs records) → Audit (cross-document checks, risks, score + evidence coverage) →
Assistant (answers from the case's findings) → Report (English/Tamil, print to PDF) → Professional review request.

## Structure
```
src/types.ts      Property / Document / Evidence / Finding / Audit models
src/engine.ts     rules: cross-document checks, claim verification, risk, score, evidence coverage
src/api.ts        the ONLY place pages call for data. Replace bodies with REST/SSE calls when the backend exists
src/store.ts      localStorage-backed store (users, cases, reviews, logs, payments, language, theme)
src/seed.ts       demo users and cases
src/pages/        Auth, Dashboard, NewCase, Case (workspace tabs), Plans, Admin
src/components/   Shell, MapView (Leaflet)
```
## What is demo
OCR values are generated (patta extent is 12.5% below the deed on purpose so the mismatch rule shows),
OTP accepts any 6 digits, payments are simulated, the assistant is rule-based, and government sources are
listed as "Not connected" in Admin > Data sources.
