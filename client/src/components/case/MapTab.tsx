import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { api } from '../../api';
import type { Case } from '../../types';
import { ErrorBox } from '../ui';

const COLOR = { water: '#0284c7', health: '#dc2626', education: '#7c3aed', transport: '#ea580c' } as const;

export default function MapTab({ c, setC }: { c: Case; setC: (c: Case) => void }) {
  const el = useRef<HTMLDivElement>(null); const map = useRef<L.Map>(); const layer = useRef<L.LayerGroup>(); const pick = useRef<L.CircleMarker>();
  const [q, setQ] = useState(`${c.village}, ${c.district}, Tamil Nadu`); const [res, setRes] = useState<{ name: string; lat: number; lng: number }[]>([]);
  const [sel, setSel] = useState<{ lat: number; lng: number } | null>(c.lat && c.lng ? { lat: c.lat, lng: c.lng } : null);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current).setView(sel ? [sel.lat, sel.lng] : [10.8, 78.7], sel ? 15 : 7);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(m);
    m.on('click', (e) => setSel({ lat: e.latlng.lat, lng: e.latlng.lng }));
    layer.current = L.layerGroup().addTo(m); map.current = m;
    return () => { m.remove(); map.current = undefined; };
  }, []); // eslint-disable-line

  useEffect(() => { // selected point
    if (!map.current) return; pick.current?.remove();
    if (sel) pick.current = L.circleMarker([sel.lat, sel.lng], { radius: 9, color: '#065f46', fillColor: '#10b981', fillOpacity: 0.9 }).addTo(map.current);
  }, [sel]);
  useEffect(() => { // nearby features
    layer.current?.clearLayers();
    c.geo?.items.forEach((i) => L.circleMarker([i.lat, i.lng], { radius: 5, color: COLOR[i.kind], fillOpacity: 0.7 }).bindTooltip(`${i.name ?? i.kind} · ${i.distance} m`).addTo(layer.current!));
  }, [c.geo]);

  const search = async () => { setErr(''); try { const r = await api.search(q); setRes(r); if (r[0]) { map.current?.setView([r[0].lat, r[0].lng], 15); } else setErr('No place found'); } catch (e) { setErr((e as Error).message); } };
  const save = async () => { if (!sel) return; setBusy(true); setErr(''); try { setC(await api.setLocation(c.id, sel.lat, sel.lng)); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  const near = (k: string) => c.geo?.items.find((i) => i.kind === k);

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap gap-2">
        <input className="inp max-w-md flex-1" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="Search village / landmark" />
        <button className="btn-o" onClick={search}>Search</button>
        <button className="btn" disabled={!sel || busy} onClick={save}>{busy ? 'Analysing…' : 'Use selected point & analyse'}</button>
      </div>
      {res.length > 1 && <div className="card text-sm">{res.map((r) => <button key={r.name} className="block w-full py-1 text-left hover:text-emerald-700" onClick={() => { map.current?.setView([r.lat, r.lng], 15); setSel({ lat: r.lat, lng: r.lng }); }}>{r.name}</button>)}</div>}
      {err && <ErrorBox msg={err} />}
      <p className="text-xs text-slate-500">Click the map to drop a pin on the plot, then analyse.</p>
      <div ref={el} className="h-[420px] rounded-xl border border-slate-200" />
      {c.geo && (
        <div className="card text-sm">
          <h3 className="mb-2 font-semibold">Nearby (from {c.geo.source})</h3>
          <div className="grid gap-2 sm:grid-cols-2">{(['water', 'health', 'education', 'transport'] as const).map((k) => { const i = near(k); return <div key={k} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR[k] }} /><span className="capitalize">{k}:</span>{i ? <b>{i.name ?? '—'} · {i.distance} m</b> : <span className="text-slate-500">none found in range</span>}</div>; })}</div>
        </div>
      )}
    </div>
  );
}
