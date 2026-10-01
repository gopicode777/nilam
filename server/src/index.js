import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { z } from 'zod';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, audit, UPLOAD_DIR } from './db.js';
import { requireUser } from './auth.js';
import { extractText, parseFields, extentToSqft } from './extract.js';
import { analyze, loadCase, DOC_TYPES } from './rules.js';
import { searchPlace, nearby } from './geo.js';
import { chat, aiConfigured } from './ai.js';

const app = express();
app.disable('x-powered-by');
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-site' },
  contentSecurityPolicy: { directives: {
    'default-src': ["'self'"], 'img-src': ["'self'", 'data:', 'https://tile.openstreetmap.org'],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], 'font-src': ["'self'", 'https://fonts.gstatic.com'],
    'frame-ancestors': ["'self'"], 'upgrade-insecure-requests': process.env.NODE_ENV === 'production' ? [] : null,
  } },
}));
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '100kb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }));
app.get('/api/health', (_q, r) => r.json({ ok: true }));
app.use('/api', requireUser);

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const parse = (schema, data) => { const r = schema.safeParse(data); if (!r.success) throw Object.assign(new Error(r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')), { status: 400 }); return r.data; };
const notFound = () => Object.assign(new Error('Not found'), { status: 404 });
const own = (req) => loadCase(req.params.id, req.user.id) ?? (() => { throw notFound(); })();

// ---------- Cases ----------
const CaseIn = z.object({ title: z.string().trim().min(3).max(120), district: z.string().trim().min(2).max(60), village: z.string().trim().min(2).max(60), survey_no: z.string().trim().min(1).max(30) });

app.get('/api/cases', (req, res) => {
  const rows = db.prepare('SELECT id FROM cases WHERE owner_id=? ORDER BY updated_at DESC').all(req.user.id);
  res.json(rows.map((r) => { const c = loadCase(r.id, req.user.id); return { id: c.id, title: c.title, district: c.district, village: c.village, survey_no: c.survey_no, updated_at: c.updated_at, score: c.score.overall, coverage: c.score.coverage, docs: c.documents.length, open_findings: c.findings.filter((f) => f.status === 'open' && f.severity !== 'info').length }; }));
});
app.post('/api/cases', (req, res) => {
  const b = parse(CaseIn, req.body), id = crypto.randomUUID();
  db.prepare('INSERT INTO cases(id,owner_id,title,district,village,survey_no) VALUES (?,?,?,?,?,?)').run(id, req.user.id, b.title, b.district, b.village, b.survey_no);
  analyze(id); audit(req.user, 'case.create', id);
  res.status(201).json(loadCase(id, req.user.id));
});
app.get('/api/cases/:id', (req, res) => res.json(own(req)));
app.delete('/api/cases/:id', (req, res) => {
  const c = own(req);
  for (const d of db.prepare('SELECT stored_name FROM documents WHERE case_id=?').all(c.id)) fs.rmSync(path.join(UPLOAD_DIR, d.stored_name), { force: true });
  db.prepare('DELETE FROM cases WHERE id=?').run(c.id); audit(req.user, 'case.delete', c.id);
  res.status(204).end();
});
app.post('/api/cases/:id/analyze', (req, res) => { const c = own(req); analyze(c.id); audit(req.user, 'case.analyze', c.id); res.json(own(req)); });

// ---------- Documents ----------
const ALLOWED = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'text/plain': '.txt' };
const upload = multer({
  storage: multer.diskStorage({ destination: UPLOAD_DIR, filename: (_q, f, cb) => cb(null, crypto.randomUUID() + (ALLOWED[f.mimetype] ?? '')) }),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (_q, f, cb) => (ALLOWED[f.mimetype] ? cb(null, true) : cb(Object.assign(new Error('Only PDF, JPG, PNG files are allowed'), { status: 415 }))),
});

async function process_(docId, caseId) {
  const d = db.prepare('SELECT * FROM documents WHERE id=?').get(docId);
  try {
    const r = await extractText(path.join(UPLOAD_DIR, d.stored_name), d.mime);
    const fields = r.text ? parseFields(r.text, r.confidence) : [];
    db.prepare('UPDATE documents SET status=?, text=?, ocr_confidence=?, fields=? WHERE id=?').run(r.status, r.text, r.confidence, JSON.stringify(fields), docId);
  } catch (e) {
    console.error('extract failed', docId, e.message);
    db.prepare("UPDATE documents SET status='failed', error=? WHERE id=?").run(String(e.message).slice(0, 300), docId);
  }
  analyze(caseId);
}

app.post('/api/cases/:id/documents', (req, res, next) => { own(req); next(); }, upload.single('file'), (req, res) => {
  const type = parse(z.enum(Object.keys(DOC_TYPES)), req.body.type);
  if (!req.file) throw Object.assign(new Error('No file'), { status: 400 });
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO documents(id,case_id,type,original_name,stored_name,mime,size) VALUES (?,?,?,?,?,?,?)').run(id, req.params.id, type, req.file.originalname.slice(0, 200), req.file.filename, req.file.mimetype, req.file.size);
  audit(req.user, 'document.upload', id);
  process_(id, req.params.id); // background; UI polls
  res.status(202).json(own(req));
});
const ownDoc = (req) => db.prepare('SELECT d.* FROM documents d JOIN cases c ON c.id=d.case_id WHERE d.id=? AND c.owner_id=?').get(req.params.id, req.user.id) ?? (() => { throw notFound(); })();
app.get('/api/documents/:id/file', (req, res) => { const d = ownDoc(req); res.type(d.mime).setHeader('Content-Disposition', 'inline'); res.sendFile(path.join(UPLOAD_DIR, d.stored_name)); });
app.delete('/api/documents/:id', (req, res) => {
  const d = ownDoc(req); fs.rmSync(path.join(UPLOAD_DIR, d.stored_name), { force: true });
  db.prepare('DELETE FROM documents WHERE id=?').run(d.id); analyze(d.case_id); audit(req.user, 'document.delete', d.id); res.status(204).end();
});
const FieldsIn = z.object({ fields: z.array(z.object({ key: z.string().max(30), label: z.string().max(60), value: z.string().trim().max(120), confidence: z.number().optional(), snippet: z.string().max(300).optional(), confirmed: z.boolean() })).max(30) });
app.put('/api/documents/:id/fields', (req, res) => {
  const d = ownDoc(req), { fields } = parse(FieldsIn, req.body);
  const clean = fields.filter((f) => f.value).map((f) => f.key === 'extent' ? { ...f, sqft: extentToSqft(f.value.match(/[\d.,]+/)?.[0] ?? '', f.value.replace(/[\d.,\s]+/, '')) } : f);
  db.prepare('UPDATE documents SET fields=? WHERE id=?').run(JSON.stringify(clean), d.id);
  analyze(d.case_id); audit(req.user, 'document.fields', d.id); res.json(loadCase(d.case_id, req.user.id));
});

// ---------- Findings ----------
app.patch('/api/findings/:id', (req, res) => {
  const b = parse(z.object({ status: z.enum(['open', 'reviewed', 'dismissed']), note: z.string().max(500).optional() }), req.body);
  const f = db.prepare('SELECT f.* FROM findings f JOIN cases c ON c.id=f.case_id WHERE f.id=? AND c.owner_id=?').get(req.params.id, req.user.id);
  if (!f) throw notFound();
  db.prepare('UPDATE findings SET status=?, note=? WHERE id=?').run(b.status, b.note ?? null, f.id);
  audit(req.user, 'finding.' + b.status, f.id); res.json(loadCase(f.case_id, req.user.id));
});

// ---------- Map / geo ----------
app.get('/api/geo/search', wrap(async (req, res) => { const q = parse(z.string().trim().min(3).max(150), req.query.q); res.json(await searchPlace(q)); }));
app.put('/api/cases/:id/location', wrap(async (req, res) => {
  const c = own(req), { lat, lng } = parse(z.object({ lat: z.number().min(6).max(14), lng: z.number().min(76).max(81) }), req.body); // Tamil Nadu bounding box
  const geo = await nearby(lat, lng);
  db.prepare('UPDATE cases SET lat=?, lng=?, geo=? WHERE id=?').run(lat, lng, JSON.stringify(geo), c.id);
  analyze(c.id); audit(req.user, 'case.location', c.id); res.json(own(req));
}));

// ---------- AI ----------
app.get('/api/cases/:id/messages', (req, res) => { const c = own(req); res.json(db.prepare('SELECT role,content,created_at FROM messages WHERE case_id=? ORDER BY id').all(c.id)); });
app.post('/api/cases/:id/chat', rateLimit({ windowMs: 60_000, limit: 20 }), wrap(async (req, res) => {
  const c = own(req), { message } = parse(z.object({ message: z.string().trim().min(1).max(2000) }), req.body);
  if (!aiConfigured()) return res.status(503).json({ error: 'AI assistant is not configured. Set ANTHROPIC_API_KEY on the server.' });
  db.prepare('INSERT INTO messages(case_id,role,content) VALUES (?,?,?)').run(c.id, 'user', message);
  const history = db.prepare('SELECT role,content FROM messages WHERE case_id=? ORDER BY id').all(c.id);
  const reply = await chat(c, history);
  db.prepare('INSERT INTO messages(case_id,role,content) VALUES (?,?,?)').run(c.id, 'assistant', reply);
  res.json({ role: 'assistant', content: reply });
}));

// ---------- Honest integration status ----------
app.get('/api/sources', (_q, res) => res.json([
  { name: 'Uploaded documents (PDF / image OCR)', status: 'live', note: 'Text PDFs and images (English + Tamil OCR). Scanned PDFs: upload page images.' },
  { name: 'OpenStreetMap (map, search, nearby)', status: 'live', note: 'Free public services; fine for pilots, use a paid provider for scale.' },
  { name: 'AI assistant (Anthropic)', status: aiConfigured() ? 'live' : 'not_configured', note: aiConfigured() ? 'Answers only from case evidence.' : 'Set ANTHROPIC_API_KEY.' },
  { name: 'TNREGINET (EC, registered deeds)', status: 'not_connected', note: 'Needs government permission / API agreement.' },
  { name: 'DTCP / CMDA approvals', status: 'not_connected', note: 'Approval references stay "unverified" until connected.' },
  { name: 'TNGIS / flood / groundwater / CRZ layers', status: 'not_connected', note: 'Environment score covers OSM waterbodies only.' },
]));

// ---------- Serve built frontend in production ----------
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(dist)) { app.use(express.static(dist)); app.get(/^\/(?!api).*/, (_q, r) => r.sendFile(path.join(dist, 'index.html'))); }

app.use((err, _req, res, _next) => {
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Something went wrong' : err.message });
});

const port = +(process.env.PORT || 8080);
if (!process.env.NODE_TEST) app.listen(port, () => console.log(`API on :${port}`));
