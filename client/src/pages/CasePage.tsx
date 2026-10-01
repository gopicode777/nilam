import { useCallback, useEffect, useState } from 'react';
import { NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import type { Case } from '../types';
import { ErrorBox, Spinner, scoreColor } from '../components/ui';
import Overview from '../components/case/Overview';
import Documents from '../components/case/Documents';
import MapTab from '../components/case/MapTab';
import Findings from '../components/case/Findings';
import Assistant from '../components/case/Assistant';
import Report from '../components/case/Report';

const tabs = [['', 'Overview'], ['documents', 'Documents'], ['map', 'Map'], ['findings', 'Findings'], ['assistant', 'AI Assistant'], ['report', 'Report']];

export default function CasePage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const [c, setC] = useState<Case | null>(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => api.getCase(id).then(setC).catch((e) => setErr(e.message)), [id]);
  useEffect(() => { load(); }, [load]);
  // While OCR/extraction is running, poll until finished.
  const busy = c?.documents.some((d) => d.status === 'processing');
  useEffect(() => { if (!busy) return; const t = setInterval(load, 2000); return () => clearInterval(t); }, [busy, load]);

  if (err) return <ErrorBox msg={err} />;
  if (!c) return <Spinner />;
  const remove = async () => { if (confirm('Delete this audit and all its documents permanently?')) { await api.deleteCase(c.id); nav('/'); } };
  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-xl font-bold">{c.title}</h1><p className="text-sm text-slate-500">{c.village}, {c.district} · Survey {c.survey_no}</p></div>
        <div className="flex items-center gap-4"><div className="text-right"><div className={`text-3xl font-bold ${scoreColor(c.score.overall)}`}>{c.score.overall ?? '—'}<span className="text-sm text-slate-400">/100</span></div><div className="text-[11px] text-slate-500">based on {c.score.coverage}% of framework</div></div><button className="btn-o" onClick={remove}>Delete</button></div>
      </div>
      <nav className="no-print mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map(([p, l]) => <NavLink key={p} to={p ? `/cases/${id}/${p}` : `/cases/${id}`} end className={({ isActive }) => `whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${isActive ? 'border-emerald-700 text-emerald-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{l}</NavLink>)}
      </nav>
      <Routes>
        <Route index element={<Overview c={c} />} />
        <Route path="documents" element={<Documents c={c} setC={setC} />} />
        <Route path="map" element={<MapTab c={c} setC={setC} />} />
        <Route path="findings" element={<Findings c={c} setC={setC} />} />
        <Route path="assistant" element={<Assistant c={c} />} />
        <Route path="report" element={<Report c={c} />} />
      </Routes>
    </div>
  );
}
