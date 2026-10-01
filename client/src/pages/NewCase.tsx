import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { ErrorBox } from '../components/ui';

export default function NewCase() {
  const nav = useNavigate();
  const [v, setV] = useState({ title: '', district: '', village: '', survey_no: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { nav(`/cases/${(await api.createCase(v)).id}`); } catch (x) { setErr((x as Error).message); setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="card mx-auto max-w-lg space-y-3">
      <h1 className="text-lg font-bold">New land audit</h1>
      {err && <ErrorBox msg={err} />}
      {([['title', 'Property name', 'Residential Plot — Nagapattinam'], ['district', 'District', 'Nagapattinam'], ['village', 'Village', 'Nagapattinam'], ['survey_no', 'Survey number (as claimed by seller)', '124/3A']] as const).map(([k, l, p]) => (
        <label key={k} className="block text-sm font-medium">{l}<input required className="inp mt-1" placeholder={p} value={v[k]} onChange={set(k)} /></label>
      ))}
      <button className="btn w-full" disabled={busy}>{busy ? 'Creating…' : 'Create audit'}</button>
    </form>
  );
}
