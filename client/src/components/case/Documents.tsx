import { useState } from 'react';
import { api } from '../../api';
import { DOC_TYPES, type Case, type Doc, type Field } from '../../types';
import { ErrorBox } from '../ui';

const FIELD_KEYS: Record<string, string> = { owner: 'Owner / seller', survey_no: 'Survey number', extent: 'Extent', village: 'Village', doc_no: 'Document number', reg_date: 'Registration date', approval_ref: 'Approval reference' };
const statusText: Record<string, string> = { processing: 'Reading document…', extracted: 'Read', needs_ocr: 'Scanned PDF — upload page images', failed: 'Failed' };

export default function Documents({ c, setC }: { c: Case; setC: (c: Case) => void }) {
  const [type, setType] = useState('sale_deed'); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    setBusy(true); setErr('');
    try { setC(await api.upload(c.id, type, f)); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  const have = new Set(c.documents.map((d) => d.type));
  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-medium">Document type<select className="inp mt-1" value={type} onChange={(e) => setType(e.target.value)}>{Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}{have.has(k) ? ' ✓' : ''}</option>)}</select></label>
          <label className={`btn cursor-pointer ${busy ? 'opacity-50' : ''}`}>{busy ? 'Uploading…' : 'Upload file'}<input type="file" hidden disabled={busy} accept=".pdf,.jpg,.jpeg,.png,.txt" onChange={onFile} /></label>
          <span className="text-xs text-slate-500">PDF / JPG / PNG, max 15 MB. English + Tamil OCR.</span>
        </div>
        {err && <div className="mt-3"><ErrorBox msg={err} /></div>}
      </div>
      {!c.documents.length && <p className="text-sm text-slate-500">No documents yet.</p>}
      {c.documents.map((d) => <DocCard key={d.id} d={d} setC={setC} />)}
    </div>
  );
}

function DocCard({ d, setC }: { d: Doc; setC: (c: Case) => void }) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<Field[]>(d.fields);
  const [err, setErr] = useState('');
  const save = async (next: Field[]) => { try { setC(await api.saveFields(d.id, next)); setErr(''); } catch (x) { setErr((x as Error).message); } };
  const upd = (i: number, p: Partial<Field>) => setFields(fields.map((f, j) => (j === i ? { ...f, ...p } : f)));
  const add = () => { const k = Object.keys(FIELD_KEYS).find((k) => !fields.some((f) => f.key === k)); if (k) setFields([...fields, { key: k, label: FIELD_KEYS[k], value: '', confirmed: true }]); };
  const remove = async () => { if (confirm('Delete this document?')) { await api.deleteDoc(d.id); setC(await api.getCase(d.case_id)); } };
  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><div className="font-semibold">{DOC_TYPES[d.type]}</div><div className="text-xs text-slate-500">{d.original_name} · {(d.size / 1024).toFixed(0)} KB · {statusText[d.status]}{d.ocr_confidence != null && ` · OCR ${(d.ocr_confidence * 100).toFixed(0)}%`}</div></div>
        <div className="flex gap-2"><a className="btn-o" href={`/api/documents/${d.id}/file`} target="_blank" rel="noreferrer">View file</a><button className="btn-o" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Review'} fields ({d.fields.length})</button><button className="btn-o" onClick={remove}>Delete</button></div>
      </div>
      {d.error && <div className="mt-2"><ErrorBox msg={d.error} /></div>}
      {open && (
        <div className="mt-3 space-y-2 border-t pt-3">
          <p className="text-xs text-slate-500">These values were read by software. Correct anything wrong, tick “confirmed”, then save.</p>
          {fields.map((f, i) => (
            <div key={i} className="grid grid-cols-[130px_1fr_auto] items-center gap-2">
              <span className="text-sm">{f.label}</span>
              <input className="inp" value={f.value} onChange={(e) => upd(i, { value: e.target.value, confirmed: false })} title={f.snippet} />
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={f.confirmed} onChange={(e) => upd(i, { confirmed: e.target.checked })} />confirmed</label>
            </div>
          ))}
          <div className="flex gap-2"><button className="btn-o" onClick={add}>+ Add field</button><button className="btn" onClick={() => save(fields)}>Save & re-check</button></div>
          {err && <ErrorBox msg={err} />}
        </div>
      )}
    </div>
  );
}
