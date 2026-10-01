import { useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import type { Case } from '../../types';
import { ErrorBox } from '../ui';

const SUGGEST = ['What are the biggest risks in this plot?', 'What documents should I still collect?', 'இந்த நிலத்தில் என்ன பிரச்சனைகள் உள்ளன?'];
export default function Assistant({ c }: { c: Case }) {
  const [msgs, setMsgs] = useState<{ role: string; content: string }[]>([]);
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { api.messages(c.id).then(setMsgs); }, [c.id]);
  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [msgs]);
  const send = async (m: string) => {
    if (!m.trim() || busy) return;
    setMsgs((x) => [...x, { role: 'user', content: m }]); setText(''); setBusy(true); setErr('');
    try { const r = await api.chat(c.id, m); setMsgs((x) => [...x, r]); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="card flex h-[60vh] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto">
        {!msgs.length && <div className="space-y-2 text-sm text-slate-500">Ask about this case. Answers use only your uploaded evidence and findings.{SUGGEST.map((s) => <button key={s} className="btn-o mr-2 mt-2" onClick={() => send(s)}>{s}</button>)}</div>}
        {msgs.map((m, i) => <div key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${m.role === 'user' ? 'ml-auto bg-emerald-700 text-white' : 'bg-slate-100'}`}>{m.content}</div>)}
        {busy && <div className="text-xs text-slate-500">Thinking…</div>}
        {err && <ErrorBox msg={err} />}
        <div ref={end} />
      </div>
      <div className="mt-3 flex gap-2"><input className="inp" value={text} placeholder="Ask in English or Tamil…" maxLength={2000} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send(text)} /><button className="btn" disabled={busy} onClick={() => send(text)}>Send</button></div>
      <p className="mt-2 text-[11px] text-slate-400">AI can make mistakes and is not legal advice. Consult a qualified advocate before buying.</p>
    </div>
  );
}
