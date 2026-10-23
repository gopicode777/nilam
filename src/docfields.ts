import type { DocType, Field } from './types';
/** Fields the audit compares, per document type. Keep in sync with FIELDS in supabase/functions/extract-document/index.ts. */
export const DOC_FIELD_KEYS: Record<DocType, string[]> = {
  sale_deed: ['seller', 'survey', 'extent', 'village', 'docno'], parent: ['seller', 'buyer', 'survey', 'extent', 'docno'],
  patta: ['holder', 'survey', 'extent', 'village'], chitta: ['holder', 'survey', 'extent'], ec: ['survey', 'period', 'entries'],
  fmb: ['survey', 'extent'], approval: ['authority', 'ref', 'survey'], tax: ['holder', 'survey', 'period'],
};
/** Empty fields: shown while AI reading runs, and kept as the manual-entry form if reading fails or is not set up. */
export const blankFields = (t: DocType): Record<string, Field> => Object.fromEntries(DOC_FIELD_KEYS[t].map(k => [k, { v: '', conf: 0, page: 1 }]));
