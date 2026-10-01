import { useEffect, useState } from 'react';
import { api } from '../api';
const st: Record<string, string> = { live: 'bg-emerald-50 text-emerald-700', not_configured: 'bg-amber-50 text-amber-700', not_connected: 'bg-slate-100 text-slate-600' };
export default function Sources() {
  const [s, setS] = useState<{ name: string; status: string; note: string }[]>([]);
  useEffect(() => { api.sources().then(setS); }, []);
  return (
    <div><h1 className="mb-1 text-xl font-bold">Data sources</h1><p className="mb-4 text-sm text-slate-500">What is really connected right now. Nothing here is simulated.</p>
      <div className="space-y-2">{s.map((x) => (
        <div key={x.name} className="card flex items-center justify-between gap-3"><div><div className="font-medium">{x.name}</div><div className="text-xs text-slate-500">{x.note}</div></div><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st[x.status]}`}>{x.status.replace('_', ' ')}</span></div>
      ))}</div></div>
  );
}
