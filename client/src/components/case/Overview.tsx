import { Link } from 'react-router-dom';
import type { Case } from '../../types';
import { Badge, scoreColor } from '../ui';

export default function Overview({ c }: { c: Case }) {
  const top = c.findings.filter((f) => f.severity !== 'info' && f.status === 'open').slice(0, 4);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card">
        <h2 className="mb-3 font-semibold">Score by category</h2>
        <div className="space-y-2.5">
          {c.score.categories.map((k) => (
            <div key={k.id}>
              <div className="flex justify-between text-sm"><span>{k.name} <span className="text-xs text-slate-400">({k.weight}%)</span></span><b className={scoreColor(k.score)}>{k.assessed ? k.score : 'Not assessed'}</b></div>
              <div className="mt-1 h-1.5 rounded bg-slate-100"><div className={`h-full rounded ${k.assessed ? 'bg-emerald-600' : ''}`} style={{ width: `${k.score ?? 0}%` }} /></div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">Categories without evidence are excluded, not scored as zero. Upload more documents and set the location to widen coverage.</p>
      </div>
      <div className="card">
        <h2 className="mb-3 font-semibold">Top open issues</h2>
        {!top.length && <p className="text-sm text-slate-500">No open high-priority issues.</p>}
        <ul className="space-y-3">{top.map((f) => <li key={f.id}><div className="mb-1"><Badge sev={f.severity} /></div><div className="text-sm font-medium">{f.title}</div><div className="text-xs text-slate-500">{f.detail}</div></li>)}</ul>
        <Link to={`/cases/${c.id}/findings`} className="mt-3 inline-block text-sm font-medium text-emerald-700">All findings →</Link>
      </div>
    </div>
  );
}
