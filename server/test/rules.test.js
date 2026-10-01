import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, similarity, score } from '../src/rules.js';
import { parseFields, extentToSqft } from '../src/extract.js';

const kase = { survey_no: '124/3A', village: 'Nagapattinam' };
const doc = (type, fields) => ({ id: type, type, status: 'extracted', fields: fields.map(([key, value, sqft]) => ({ key, label: key, value, sqft, confirmed: true })) });

test('similarity ignores initials and titles', () => { assert.ok(similarity('Ramesh Kumar', 'Ramesh Kumar S') >= 0.9); assert.ok(similarity('Ramesh Kumar', 'Suresh Babu') < 0.5); });
test('extent units normalise', () => { assert.equal(extentToSqft('1', 'cent'), 435.6); assert.equal(extentToSqft('1', 'ground'), 2400); });
test('parseFields reads English deed', () => { const f = parseFields('Vendor: Ramesh Kumar\nS.No. 124/3A\nExtent: 2,400 sq.ft', null); assert.deepEqual(f.map((x) => x.key).sort(), ['extent', 'owner', 'survey_no']); });
test('extent >0.5% flagged; <=0.5% not', () => {
  const a = evaluate(kase, [doc('sale_deed', [['extent', '2400 sq.ft', 2400]]), doc('patta', [['extent', '2385 sq.ft', 2385]])], null);
  assert.ok(a.some((f) => f.code === 'EXTENT_DIFF'));
  const b = evaluate(kase, [doc('sale_deed', [['extent', '2400 sq.ft', 2400]]), doc('patta', [['extent', '2395 sq.ft', 2395]])], null);
  assert.ok(!b.some((f) => f.code === 'EXTENT_DIFF'));
});
test('survey mismatch + missing docs + approval claim', () => {
  const f = evaluate(kase, [doc('sale_deed', [['survey_no', '124/3A'], ['approval_ref', 'DTCP/LO No. 1/2019']]), doc('patta', [['survey_no', '124/3']])], null);
  for (const c of ['SURVEY_MISMATCH', 'MISSING_DOC', 'APPROVAL_UNVERIFIED']) assert.ok(f.some((x) => x.code === c), c);
});
test('score excludes unassessed categories', () => { const s = score([], [], null); assert.equal(s.coverage, 5); });
