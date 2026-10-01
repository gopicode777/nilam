import crypto from 'node:crypto';
import { db } from './db.js';
import { normSurvey, extentToSqft } from './extract.js';

// Framework weights (from the prototype). A category only counts once there is evidence to assess it.
export const CATEGORIES = [
  ['legal', 'Legal Identity & Title', 20], ['revenue', 'Revenue & Survey', 20], ['planning', 'Planning & Approvals', 15],
  ['access', 'Access & Physical Condition', 10], ['environment', 'Environment & Resilience', 10],
  ['neighbourhood', 'Neighbourhood & Utilities', 10], ['market', 'Market & Price', 10], ['evidence', 'Evidence Quality', 5],
];
export const DOC_TYPES = {
  sale_deed: 'Sale Deed', parent_deed: 'Parent Deed', ec: 'Encumbrance Certificate', patta: 'Patta / Chitta',
  tslr: 'TSLR', fmb: 'FMB / Survey Sketch', a_register: 'A-Register', approval: 'Approval Documents', tax: 'Tax / Utility Records', other: 'Other',
};
const REQUIRED = [['sale_deed', 'legal', 'red'], ['ec', 'legal', 'red'], ['patta', 'revenue', 'red'], ['fmb', 'revenue', 'amber']];

const normName = (s) => s.toLowerCase().replace(/\b(mr|mrs|ms|shri|thiru|tmt|s\/o|d\/o|w\/o)\b\.?/g, '').replace(/\b[a-z]\b\.?/g, '').replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
export function similarity(a, b) {
  a = normName(a); b = normName(b);
  if (!a || !b) return 0; if (a === b) return 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - d[a.length][b.length] / Math.max(a.length, b.length);
}

const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);

/** Pure function: docs + case -> findings (no DB access, easy to unit test). */
export function evaluate(kase, docs, geo) {
  const F = [];
  const add = (code, category, severity, title, detail, evidence = [], action = null, salt = '') =>
    F.push({ key: `${code}:${hash(salt || title)}`, code, category, severity, title, detail, evidence, action });

  const have = new Set(docs.map((d) => d.type));
  for (const [type, cat, sev] of REQUIRED)
    if (!have.has(type)) add('MISSING_DOC', cat, sev, `${DOC_TYPES[type]} not uploaded`, `No ${DOC_TYPES[type]} is attached to this case, so related checks could not run.`, [], `Obtain and upload the ${DOC_TYPES[type]}.`, type);

  const vals = (key) => docs.flatMap((d) => d.fields.filter((f) => f.key === key && f.value).map((f) => ({ doc: DOC_TYPES[d.type] || d.type, f })));
  const ev = (arr) => arr.map((x) => ({ document: x.doc, value: x.f.value, snippet: x.f.snippet }));

  const owners = vals('owner');
  if (owners.length >= 2) {
    const ref = owners[0];
    const bad = owners.filter((o) => similarity(o.f.value, ref.f.value) < 0.9);
    if (bad.length) add('OWNER_MISMATCH', 'legal', 'red', 'Owner name differs between documents', `"${ref.f.value}" (${ref.doc}) does not match ${bad.map((b) => `"${b.f.value}" (${b.doc})`).join(', ')} at the 90% threshold.`, ev(owners), 'Ask the seller to explain and provide supporting name-change / legal-heir documents.');
  }

  const surveys = vals('survey_no');
  const claimed = normSurvey(kase.survey_no);
  const distinct = [...new Set(surveys.map((s) => normSurvey(s.f.value)))];
  if (distinct.length > 1) add('SURVEY_MISMATCH', 'revenue', 'red', 'Survey number differs between documents', `Documents show different survey numbers: ${distinct.join(', ')}.`, ev(surveys), 'Verify the correct survey / sub-division with the Taluk office.');
  else if (distinct.length === 1 && distinct[0] !== claimed) add('SURVEY_VS_CASE', 'revenue', 'amber', 'Documents disagree with the survey number entered for this case', `Case says ${kase.survey_no}; documents say ${distinct[0]}.`, ev(surveys), 'Confirm which survey number is being purchased.');

  const ext = docs.flatMap((d) => d.fields.filter((f) => f.key === 'extent' && f.sqft).map((f) => ({ doc: DOC_TYPES[d.type] || d.type, f })));
  if (ext.length >= 2) {
    const min = Math.min(...ext.map((e) => e.f.sqft)), max = Math.max(...ext.map((e) => e.f.sqft));
    const pct = ((max - min) / max) * 100;
    if (pct > 0.5) add('EXTENT_DIFF', 'revenue', pct > 5 ? 'red' : 'amber', 'Extent differs between documents', `Extents differ by ${(max - min).toFixed(0)} sq.ft (${pct.toFixed(2)}%). Tolerance is 0.5%.`, ev(ext), 'Get a licensed survey to establish the true extent.');
  }

  for (const a of vals('approval_ref'))
    add('APPROVAL_UNVERIFIED', 'planning', 'amber', 'Layout approval could not be verified', `Reference ${a.f.value} appears in ${a.doc}. This is a claim; no official DTCP/CMDA source is connected, so it is not verified.`, ev([a]), 'Verify the approval directly with DTCP / CMDA.', a.f.value);

  const village = vals('village');
  if (village.length && kase.village) {
    const off = village.filter((v) => similarity(v.f.value, kase.village) < 0.8);
    if (off.length) add('VILLAGE_MISMATCH', 'revenue', 'amber', 'Village differs from case details', `Case village is ${kase.village}; ${off.map((o) => `${o.f.value} (${o.doc})`).join(', ')} found in documents.`, ev(off));
  }

  const weak = docs.filter((d) => d.status === 'needs_ocr' || d.status === 'failed' || !d.fields.length);
  for (const d of weak) add('DOC_UNREADABLE', 'evidence', 'amber', `${DOC_TYPES[d.type]}: no fields could be read`, d.status === 'needs_ocr' ? 'This looks like a scanned PDF. Upload page images (JPG/PNG) so OCR can read them.' : 'No recognisable fields were extracted. Review manually.', [], 'Upload a clearer copy, or enter the fields manually.', d.id);
  const unconfirmed = docs.flatMap((d) => d.fields).filter((f) => !f.confirmed).length;
  if (unconfirmed) add('UNCONFIRMED_FIELDS', 'evidence', 'info', `${unconfirmed} extracted field(s) not yet confirmed by you`, 'Extracted values are machine-read candidates. Confirm or correct them before relying on the results.', [], 'Open Documents and confirm each field.', 'unconfirmed');

  if (geo) {
    const water = geo.items.filter((i) => i.kind === 'water' && i.distance <= 500).sort((a, b) => a.distance - b.distance)[0];
    if (water) add('WATERBODY_NEAR', 'environment', 'amber', 'Waterbody within 500 m', `${water.name || 'A waterbody'} is about ${water.distance} m from the plot (OpenStreetMap data).`, [], 'Check flood history and setback rules with the local authority.');
  }
  return F;
}

/** Score only what has evidence. `coverage` says how much of the framework was actually assessed. */
export function score(docs, findings, geo) {
  const active = findings.filter((f) => f.status !== 'dismissed');
  const assessed = new Set(['evidence']);
  if (docs.length) { assessed.add('legal'); assessed.add('revenue'); }
  if (docs.some((d) => d.type === 'approval')) assessed.add('planning');
  if (geo) { assessed.add('environment'); assessed.add('neighbourhood'); }
  const pen = { red: 30, amber: 12, info: 0 };
  const cats = CATEGORIES.map(([id, name, weight]) => {
    const on = assessed.has(id);
    const s = on ? Math.max(0, 100 - active.filter((f) => f.category === id).reduce((a, f) => a + pen[f.severity], 0)) : null;
    return { id, name, weight, score: s, assessed: on };
  });
  const a = cats.filter((c) => c.assessed), w = a.reduce((x, c) => x + c.weight, 0);
  return { overall: w ? Math.round(a.reduce((x, c) => x + c.score * c.weight, 0) / w) : null, coverage: w, categories: cats };
}

export function analyze(caseId) {
  const kase = db.prepare('SELECT * FROM cases WHERE id=?').get(caseId);
  const docs = db.prepare('SELECT * FROM documents WHERE case_id=?').all(caseId).map((d) => ({ ...d, fields: JSON.parse(d.fields) }));
  const geo = kase.geo ? JSON.parse(kase.geo) : null;
  const next = evaluate(kase, docs, geo);
  const old = new Map(db.prepare('SELECT key,status,note FROM findings WHERE case_id=?').all(caseId).map((r) => [r.key, r]));
  db.transaction(() => {
    db.prepare('DELETE FROM findings WHERE case_id=?').run(caseId);
    const ins = db.prepare('INSERT INTO findings(id,case_id,key,code,category,severity,title,detail,evidence,action,status,note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
    for (const f of next) {
      const o = old.get(f.key);
      ins.run(crypto.randomUUID(), caseId, f.key, f.code, f.category, f.severity, f.title, f.detail, JSON.stringify(f.evidence), f.action, o?.status ?? 'open', o?.note ?? null);
    }
    db.prepare("UPDATE cases SET updated_at=datetime('now') WHERE id=?").run(caseId);
  })();
}

export function loadCase(caseId, ownerId) {
  const kase = db.prepare('SELECT * FROM cases WHERE id=? AND owner_id=?').get(caseId, ownerId);
  if (!kase) return null;
  const documents = db.prepare('SELECT id,case_id,type,original_name,mime,size,status,error,ocr_confidence,fields,created_at FROM documents WHERE case_id=? ORDER BY created_at').all(caseId).map((d) => ({ ...d, fields: JSON.parse(d.fields) }));
  const findings = db.prepare("SELECT * FROM findings WHERE case_id=? ORDER BY CASE severity WHEN 'red' THEN 0 WHEN 'amber' THEN 1 ELSE 2 END").all(caseId).map((f) => ({ ...f, evidence: JSON.parse(f.evidence) }));
  const geo = kase.geo ? JSON.parse(kase.geo) : null;
  return { ...kase, geo, documents, findings, score: score(documents, findings, geo) };
}
