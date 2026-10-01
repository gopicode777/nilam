export type Sev = 'red' | 'amber' | 'info';
export interface Field { key: string; label: string; value: string; confidence?: number; snippet?: string; confirmed: boolean }
export interface Doc { id: string; case_id: string; type: string; original_name: string; mime: string; size: number; status: 'processing' | 'extracted' | 'needs_ocr' | 'failed'; error?: string; ocr_confidence?: number; fields: Field[] }
export interface Finding { id: string; code: string; category: string; severity: Sev; title: string; detail: string; evidence: { document: string; value: string; snippet?: string }[]; action?: string; status: 'open' | 'reviewed' | 'dismissed'; note?: string }
export interface GeoItem { kind: 'water' | 'health' | 'education' | 'transport'; name?: string; lat: number; lng: number; distance: number }
export interface Cat { id: string; name: string; weight: number; score: number | null; assessed: boolean }
export interface Case { id: string; title: string; district: string; village: string; survey_no: string; lat?: number; lng?: number; geo?: { items: GeoItem[]; fetched_at: string; source: string }; documents: Doc[]; findings: Finding[]; score: { overall: number | null; coverage: number; categories: Cat[] } }
export interface CaseRow { id: string; title: string; district: string; village: string; survey_no: string; updated_at: string; score: number | null; coverage: number; docs: number; open_findings: number }
export const DOC_TYPES: Record<string, string> = { sale_deed: 'Sale Deed', parent_deed: 'Parent Deed', ec: 'Encumbrance Certificate', patta: 'Patta / Chitta', tslr: 'TSLR', fmb: 'FMB / Survey Sketch', a_register: 'A-Register', approval: 'Approval Documents', tax: 'Tax / Utility Records', other: 'Other' };
