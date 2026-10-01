import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { DATA_DIR } from './db.js';

const require = createRequire(import.meta.url);

/** Returns { text, confidence|null, status } */
export async function extractText(filePath, mime) {
  if (mime === 'application/pdf') {
    const pdfParse = require('pdf-parse/lib/pdf-parse.js');
    const { text } = await pdfParse(fs.readFileSync(filePath));
    if (text.replace(/\s/g, '').length < 40) return { text: '', confidence: null, status: 'needs_ocr' };
    return { text, confidence: null, status: 'extracted' };
  }
  if (mime === 'text/plain') return { text: fs.readFileSync(filePath, 'utf8'), confidence: null, status: 'extracted' };

  // Images -> Tesseract OCR (English + Tamil). Language data is downloaded once and cached in DATA_DIR.
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng+tam', 1, { cachePath: path.join(DATA_DIR, 'tessdata') });
  try {
    const { data } = await worker.recognize(filePath);
    return { text: data.text, confidence: data.confidence / 100, status: 'extracted' };
  } finally {
    await worker.terminate();
  }
}

const UNIT_TO_SQFT = { sqft: 1, sqm: 10.7639, acre: 43560, cent: 435.6, ground: 2400, hectare: 107639 };
const unitKey = (u) => {
  u = u.toLowerCase().replace(/[\s.]/g, '');
  if (u.startsWith('sqf') || u === 'squarefeet') return 'sqft';
  if (u.startsWith('sqm')) return 'sqm';
  if (u.startsWith('acre')) return 'acre';
  if (u.startsWith('cent')) return 'cent';
  if (u.startsWith('ground')) return 'ground';
  if (u.startsWith('hect')) return 'hectare';
  return null;
};

export const normSurvey = (s) => String(s).toUpperCase().replace(/\s+/g, '');
export const extentToSqft = (value, unit) => {
  const k = unitKey(unit);
  return k ? Math.round(parseFloat(String(value).replace(/,/g, '')) * UNIT_TO_SQFT[k] * 100) / 100 : null;
};

const P = [
  ['survey_no', 'Survey number', /(?:survey\s*(?:no\.?|number)|s\.?\s*no\.?|சர்வே\s*எண்|புல\s*எண்)\s*[:\-]?\s*(\d+(?:\s*\/\s*\d+[A-Za-z]?)?[A-Za-z]?)/i],
  ['owner', 'Owner / seller', /(?:seller|vendor|owner|pattadar|patta\s*holder|பட்டாதாரர்|விற்பனையாளர்)(?:\s*name)?\s*[:\-]\s*([A-Za-z][A-Za-z .]{2,60}?)(?=\s{2,}|\n|,|;|$)/im],
  ['village', 'Village', /(?:village|கிராமம்)\s*[:\-]\s*([A-Za-z][A-Za-z ]{2,40}?)(?=\s{2,}|\n|,|;|$)/im],
  ['doc_no', 'Document number', /(?:doc(?:ument)?\.?\s*(?:no\.?|number))\s*[:\-]?\s*(\d+\s*\/\s*\d{4})/i],
  ['reg_date', 'Registration date', /(?:registered\s*on|registration\s*date|date\s*of\s*registration)\s*[:\-]?\s*(\d{1,2}[-\/.]\d{1,2}[-\/.]\d{2,4})/i],
  ['approval_ref', 'Approval reference', /\b((?:DTCP|CMDA)\s*\/\s*[A-Z]{1,3}\s*(?:No\.?)?\s*\d+\s*\/\s*\d{4})/i],
];

/** Pattern-based field extraction. Every field is a *candidate* the user must confirm. */
export function parseFields(text, ocrConfidence) {
  const out = [];
  const base = ocrConfidence ?? 0.85;
  const snippet = (m) => {
    const i = m.index;
    return text.slice(Math.max(0, i - 10), i + m[0].length + 20).replace(/\s+/g, ' ').trim();
  };
  for (const [key, label, re] of P) {
    const m = re.exec(text);
    if (m) out.push({ key, label, value: m[1].trim(), confidence: +Math.min(base, 0.9).toFixed(2), snippet: snippet(m), confirmed: false });
  }
  const em = /(?:extent|area|விஸ்தீர்ணம்|பரப்பு)\s*[:\-]?\s*([0-9][0-9,]*\.?[0-9]*)\s*(sq\.?\s*ft|sq\.?\s*feet|square\s*feet|sq\.?\s*m|acres?|cents?|grounds?|hectares?)/i.exec(text);
  if (em) {
    const sqft = extentToSqft(em[1], em[2]);
    if (sqft) out.push({ key: 'extent', label: 'Extent', value: `${em[1]} ${em[2]}`, sqft, confidence: +Math.min(base, 0.9).toFixed(2), snippet: snippet(em), confirmed: false });
  }
  return out;
}
