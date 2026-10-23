import { useRef, useState } from 'react';
import { useL } from '../i18n';
import * as api from '../api';
import type { MapPlace } from '../types';

interface Msg { u?: boolean; t: string; places?: MapPlace[] }
interface Props { lat: number; lng: number; height?: number; onPlaces: (p: MapPlace[]) => void; onSelect: (n: number) => void }

/**
 * Chat beside the map. Ask about the dropped pin: "hospitals nearby", "PG hostels within 3 km", "bus stops".
 * Names and distances come from OpenStreetMap data on the server; the AI only words the answer.
 */
export default function MapChat({ lat, lng, height = 560, onPlaces, onSelect }: Props) {
  const { L, lang } = useL(), cats = useRef<string[]>([]), end = useRef<HTMLDivElement>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]), [q, setQ] = useState(''), [busy, setBusy] = useState(false), [area, setArea] = useState('');
  const chips: [string, string][] = [[L('Hospitals nearby', 'அருகிலுள்ள மருத்துவமனைகள்'), 'hospitals nearby'], [L('PG / hostels', 'PG / விடுதிகள்'), 'PG hostels nearby'], [L('Schools', 'பள்ளிகள்'), 'schools nearby'], [L('Bus stops', 'பேருந்து நிறுத்தங்கள்'), 'bus stops nearby'], [L('Supermarkets', 'மளிகை / சூப்பர் மார்க்கெட்'), 'supermarkets nearby'], [L('Pharmacy', 'மருந்தகம்'), 'pharmacy nearby']];
  const send = async (text: string) => {
    const x = text.trim(); if (!x || busy) return; setQ(''); setBusy(true);
    setMsgs(m => [...m, { u: true, t: x }]); setTimeout(() => end.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    const r = await api.askMap(lat, lng, x, lang, cats.current);
    if ('error' in r) {
      const t = r.error === 'RATE_LIMIT' ? L('Too many questions this hour. Try again later.', 'ஒரு மணி நேரத்தில் அதிக கேள்விகள். பின்னர் முயற்சிக்கவும்.')
        : r.error === 'DATA_UNAVAILABLE' ? L('The free map-data servers are busy right now. Try again in a minute.', 'இலவச வரைபட தரவு சேவையகங்கள் பிஸியாக உள்ளன. ஒரு நிமிடம் கழித்து முயற்சிக்கவும்.')
        : L('Could not get an answer. Please try again.', 'பதில் பெற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.');
      setMsgs(m => [...m, { t }]);
    } else { cats.current = r.cats; if (r.area) setArea(r.area); onPlaces(r.places); setMsgs(m => [...m, { t: r.answer, places: r.places }]); }
    setBusy(false); setTimeout(() => end.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };
  return <div className="panel" style={{ display: 'flex', flexDirection: 'column', height: height + 96, minHeight: 420 }}>
    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line, #E3E8E5)' }}>
      <b>{L('Ask about this place', 'இந்த இடத்தைப் பற்றி கேளுங்கள்')}</b>
      <div className="mu sm" style={{ marginTop: 2 }}>{area ? `${area} · ` : ''}{lat.toFixed(5)}, {lng.toFixed(5)}</div>
      <div className="mu sm">{L('Drop or move the pin on the map, then ask. Data: OpenStreetMap.', 'வரைபடத்தில் பின்னை வைத்து / நகர்த்தி கேளுங்கள். தரவு: OpenStreetMap.')}</div>
    </div>
    <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }} aria-live="polite">
      {!msgs.length && <div className="mu sm">{L('Try: "hospitals within 3 km", "PG hostels nearby", "nearest bus stop". Distances are straight-line and, where available, by road.', 'முயற்சிக்கவும்: "3 கி.மீ-க்குள் மருத்துவமனைகள்", "அருகில் PG விடுதிகள்", "அருகிலுள்ள பேருந்து நிறுத்தம்".')}</div>}
      {msgs.map((m, i) => <div key={i} style={{ alignSelf: m.u ? 'flex-end' : 'flex-start', maxWidth: '92%' }}>
        <div style={{ background: m.u ? '#0E7A55' : 'var(--soft, #F1F4F2)', color: m.u ? '#fff' : 'inherit', padding: '9px 12px', borderRadius: 12, whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.5 }}>{m.t}</div>
        {!!m.places?.length && <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>{m.places.map(p => <button key={p.n} className="btn o sm" onClick={() => onSelect(p.n)} title={p.name}>{p.n}. {p.name.length > 22 ? p.name.slice(0, 21) + '…' : p.name} · {(p.roadKm ?? p.km).toFixed(1)} km</button>)}</div>}
      </div>)}
      {busy && <div className="mu sm" role="status">{L('Looking up the map data…', 'வரைபட தரவை தேடுகிறது…')}</div>}
      <div ref={end} />
    </div>
    <div style={{ padding: 12, borderTop: '1px solid var(--line, #E3E8E5)' }}>
      <div className="row wrap" style={{ gap: 6, marginBottom: 8 }}>{chips.map(([l, v]) => <button key={v} className="btn o sm" disabled={busy} onClick={() => send(v)}>{l}</button>)}</div>
      <div className="row" style={{ gap: 8 }}>
        <input className="in" style={{ flex: 1 }} value={q} maxLength={300} placeholder={L('Ask: hospitals within 3 km…', 'கேளுங்கள்: 3 கி.மீ-க்குள் மருத்துவமனைகள்…')} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && send(q)} aria-label="Ask the map assistant" />
        <button className="btn" disabled={busy || !q.trim()} onClick={() => send(q)}>{L('Ask', 'கேள்')}</button>
      </div>
    </div>
  </div>;
}
