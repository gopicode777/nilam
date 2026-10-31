import { describe, expect, it } from 'vitest';
import { analyze } from '../engine';
import type { Case, Doc } from '../types';

const base = (): Case => ({ id: 'C-T', ownerId: 'u', created: '2026-01-01T00:00:00Z', district: 'Erode', taluk: '', village: 'Karungalpalayam', survey: '123/4', extent: 2400, seller: 'Ravi Kumar', ptype: 'Residential plot', purpose: 'Buy', lat: 11.27, lng: 77.67, radius: 2000, claims: [], docs: [], paid: false } as Case);
const doc = (type: string, fields: Record<string, string>, verified = true): Doc => ({ id: type, type, name: `${type}.pdf`, uploaded: '2026-01-01T00:00:00Z', verified, fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, { v, conf: 95, page: 1 }])) } as Doc);
const clean = (): Case => ({ ...base(), docs: [doc('sale_deed', { seller: 'Ravi Kumar', survey: '123/4', extent: '2400', village: 'Karungalpalayam', docno: '1/2020' }), doc('patta', { holder: 'Ravi Kumar', survey: '123/4', extent: '2400', village: 'Karungalpalayam' }), doc('ec', { survey: '123/4', period: '2011-2026', entries: '0' })] });

describe('audit engine', () => {
  it('returns a score between 0 and 100 with a verdict', () => {
    const a = analyze(clean());
    expect(a.total).toBeGreaterThanOrEqual(0); expect(a.total).toBeLessThanOrEqual(100);
    expect(a.verdict.en.length).toBeGreaterThan(0); expect(['ok', 'warn', 'bad']).toContain(a.tone);
  });
  it('raises no critical finding when deed, patta and EC agree', () => {
    expect(analyze(clean()).counts.critical).toBe(0);
  });
  it('flags a seller who is not the patta holder as critical and caps the score', () => {
    const c = clean(); c.docs[0] = doc('sale_deed', { seller: 'Somebody Else', survey: '123/4', extent: '2400', village: 'Karungalpalayam', docno: '1/2020' });
    const a = analyze(c);
    expect(a.counts.critical).toBeGreaterThan(0); expect(a.total).toBeLessThanOrEqual(59);
    expect(a.findings.some(f => f.cat === 'legal' && f.sev === 'critical')).toBe(true);
  });
  it('flags a survey number mismatch between deed and patta', () => {
    const c = clean(); c.docs[1] = doc('patta', { holder: 'Ravi Kumar', survey: '999/1', extent: '2400', village: 'Karungalpalayam' });
    expect(analyze(c).findings.some(f => f.cat === 'revenue' && f.sev === 'high')).toBe(true);
  });
  it('flags an extent difference above 10% as high', () => {
    const c = clean(); c.docs[1] = doc('patta', { holder: 'Ravi Kumar', survey: '123/4', extent: '2000', village: 'Karungalpalayam' });
    expect(analyze(c).findings.some(f => f.cat === 'revenue' && f.title.en.includes('Extent mismatch'))).toBe(true);
  });
  it('flags encumbrance entries', () => {
    const c = clean(); c.docs[2] = doc('ec', { survey: '123/4', period: '2011-2026', entries: '2' });
    expect(analyze(c).findings.some(f => f.title.en.includes('encumbrance entries'))).toBe(true);
  });
  it('lists what was not checked when documents are missing', () => {
    expect(analyze(base()).pending.length).toBeGreaterThan(0);
  });
  it('does not call a case with no documents low risk', () => {
    expect(analyze(base()).tone).not.toBe('ok');
  });
});
