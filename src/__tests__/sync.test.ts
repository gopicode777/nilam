import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DOC_FIELD_KEYS, blankFields } from '../docfields';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
describe('server and app stay in step', () => {
  it('extract-document reads exactly the fields the audit compares', () => {
    const src = read('supabase/functions/extract-document/index.ts'), block = src.slice(src.indexOf('const FIELDS'), src.indexOf('type Reading'));
    for (const [type, keys] of Object.entries(DOC_FIELD_KEYS)) {
      const line = block.split('\n').find(l => l.trim().startsWith(`${type}:`)); expect(line, `${type} missing in the function`).toBeTruthy();
      const fnKeys = [...line!.matchAll(/(\w+): '/g)].map(m => m[1]); expect(fnKeys.sort(), type).toEqual([...keys].sort());
    }
  });
  it('run-audit uses the same rules file as the app (run scripts/sync-functions.sh after editing engine.ts)', () => {
    expect(read('supabase/functions/run-audit/engine.ts')).toBe(read('src/engine.ts').replace("from './types'", "from './types.ts'"));
    expect(read('supabase/functions/run-audit/types.ts')).toBe(read('src/types.ts'));
  });
  it('blank fields cover every key of a document type', () => { expect(Object.keys(blankFields('sale_deed')).sort()).toEqual([...DOC_FIELD_KEYS.sale_deed].sort()); });
});
