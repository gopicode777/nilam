import { api } from '../../api';
import type { Case } from '../../types';
import { Badge } from '../ui';

export default function Findings({ c, setC }: { c: Case; setC: (c: Case) => void }) {
  const set = async (id: string, status: string) => setC(await api.reviewFinding(id, status));
  return (
    <div className="space-y-3">
      {!c.findings.length && <p className="text-sm text-slate-500">No findings.</p>}
      {c.findings.map((f) => (
        <div key={f.id} className={`card ${f.status === 'dismissed' ? 'opacity-50' : ''}`}>
          <div className="mb-1 flex items-center justify-between"><Badge sev={f.severity} /><span className="text-xs text-slate-500">{f.status}</span></div>
          <div className="font-semibold">{f.title}</div>
          <p className="text-sm text-slate-600">{f.detail}</p>
          {f.evidence.length > 0 && <ul className="mt-2 space-y-1 rounded-lg bg-slate-50 p-2 text-xs">{f.evidence.map((e, i) => <li key={i}><b>{e.document}:</b> {e.value}{e.snippet && <span className="text-slate-500"> — “{e.snippet}”</span>}</li>)}</ul>}
          {f.action && <p className="mt-2 text-sm"><b>Suggested action:</b> {f.action}</p>}
          <div className="mt-3 flex gap-2">
            {f.status !== 'reviewed' && <button className="btn-o" onClick={() => set(f.id, 'reviewed')}>Mark reviewed</button>}
            {f.status !== 'dismissed' ? <button className="btn-o" onClick={() => set(f.id, 'dismissed')}>Dismiss</button> : <button className="btn-o" onClick={() => set(f.id, 'open')}>Reopen</button>}
          </div>
        </div>
      ))}
    </div>
  );
}
