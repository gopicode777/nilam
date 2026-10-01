import { DOC_TYPES } from './rules.js';

export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

const SYSTEM = `You are the assistant inside a Tamil Nadu land-audit tool. Answer ONLY from the CASE DATA provided.
Rules: never invent facts, laws, or document contents; if the data does not say, say it is not in the evidence and what document would show it.
Extracted values marked confirmed=false are machine-read candidates - say so. Findings are risk indicators, not legal conclusions.
You are not a lawyer: for legal decisions recommend a qualified advocate / surveyor. Reply in the user's language (Tamil or English), concisely.`;

export function caseContext(c) {
  return JSON.stringify({
    case: { id: c.id, title: c.title, district: c.district, village: c.village, survey_no: c.survey_no },
    score: c.score,
    documents: c.documents.map((d) => ({ type: DOC_TYPES[d.type], status: d.status, fields: d.fields.map(({ label, value, confirmed, snippet }) => ({ label, value, confirmed, snippet })) })),
    findings: c.findings.filter((f) => f.status !== 'dismissed').map(({ severity, title, detail, action, evidence }) => ({ severity, title, detail, action, evidence })),
    nearby_osm: c.geo?.items.slice(0, 15) ?? 'location not set',
    not_connected: ['TNREGINET', 'DTCP', 'CMDA', 'TNGIS', 'flood/groundwater/CRZ layers'],
  });
}

export async function chat(c, history) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', max_tokens: 1000,
      system: `${SYSTEM}\n\nCASE DATA:\n${caseContext(c)}`,
      messages: history.slice(-20).map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!r.ok) throw new Error(`AI provider returned ${r.status}`);
  const j = await r.json();
  return j.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}
