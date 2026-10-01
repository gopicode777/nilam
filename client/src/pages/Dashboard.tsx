import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { CaseRow } from '../types';
import { ErrorBox, Spinner, scoreColor } from '../components/ui';

export default function Dashboard() {
  const [rows, setRows] = useState<CaseRow[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.cases().then(setRows).catch((e) => setErr(e.message)); }, []);
  if (err) return <ErrorBox msg={err} />;
  if (!rows) return <Spinner />;
  return (
    <div>
      <div className="mb-4 flex items-center justify-between"><h1 className="text-xl font-bold">Your land audits</h1><Link to="/new" className="btn">+ New audit</Link></div>
      {!rows.length && <div className="card text-center text-sm text-slate-500">No audits yet. Start one, then upload the Sale Deed, Patta and EC.</div>}
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <Link key={r.id} to={`/cases/${r.id}`} className="card block hover:border-emerald-400">
            <div className="flex items-start justify-between gap-3">
              <div><div className="font-semibold">{r.title}</div><div className="text-xs text-slate-500">{r.village}, {r.district} · Survey {r.survey_no}</div></div>
              <div className="text-right"><div className={`text-2xl font-bold ${scoreColor(r.score)}`}>{r.score ?? '—'}</div><div className="text-[11px] text-slate-500">{r.coverage}% assessed</div></div>
            </div>
            <div className="mt-3 text-xs text-slate-600">{r.docs} documents · {r.open_findings} open findings</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
