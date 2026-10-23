import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapPlace, NearbyItem, Plot } from '../types';
import { useL } from '../i18n';
import { STREET_STYLE, esriStreetStyle, satStyle } from '../lib/tiles';

interface Props {
  lat: number; lng: number; sqft: number; radius?: number; nearby?: Record<string, NearbyItem[]>;
  onPick?: (lat: number, lng: number) => void; plot?: Plot; onPlot?: (p: Plot | null) => void;
  /** Numbered markers from the map assistant, and the one to zoom to. */
  places?: MapPlace[]; activePlace?: number; height?: number;
}
type Pt = [number, number]; // [lat, lng]
type Hit = { display_name: string; lat: string; lon: string };
type FC = GeoJSON.FeatureCollection;
const empty = (): FC => ({ type: 'FeatureCollection', features: [] });
const poly = (ring: [number, number][]): GeoJSON.Feature => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]]] } });
const circlePoly = (lat: number, lng: number, r: number): GeoJSON.Feature => {
  const dl = r / 111320, dn = r / (111320 * Math.cos((lat * Math.PI) / 180));
  return poly(Array.from({ length: 64 }, (_, i) => { const a = (i / 64) * 2 * Math.PI; return [lng + dn * Math.cos(a), lat + dl * Math.sin(a)] as [number, number]; }));
};

/** Area of a small polygon (a plot) in square feet, using a local flat projection. Accurate to well under 1% for plot-sized shapes. */
export function polyAreaSqft(pts: Pt[]) {
  if (pts.length < 3) return 0;
  const lat0 = pts.reduce((a, p) => a + p[0], 0) / pts.length, lng0 = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180), ky = 110540;
  const xy = pts.map(p => [(p[1] - lng0) * kx, (p[0] - lat0) * ky]); let a = 0;
  xy.forEach(([x1, y1], i) => { const [x2, y2] = xy[(i + 1) % xy.length]; a += x1 * y2 - x2 * y1; });
  return (Math.abs(a) / 2) * 10.7639;
}
/** Tamil Nadu land units: 1 cent = 435.6 sq ft, 1 ground = 2400 sq ft, 1 acre = 43560 sq ft. */
export const fmtArea = (sqft: number) => `${Math.round(sqft).toLocaleString('en-IN')} sq ft · ${(sqft / 435.6).toFixed(2)} cents · ${(sqft / 2400).toFixed(2)} grounds · ${(sqft / 43560).toFixed(3)} acres`;

const SOURCES = ['declared', 'radius', 'drawn', 'draw', 'you'] as const;
type SrcId = (typeof SOURCES)[number];

/**
 * MapLibre map: clear OpenFreeMap street view by default, satellite on demand.
 * Editable when `onPick` is given: click the map, drag the pin, search a place, paste coordinates,
 * press "My location", or switch on "Live follow". GPS needs https (or localhost) and permission.
 */
export default function MapView({ lat, lng, sqft, radius, nearby, onPick, plot, onPlot, places, activePlace, height = 420 }: Props) {
  const { L: T } = useL();
  const el = useRef<HTMLDivElement>(null), map = useRef<maplibregl.Map>(), pick = useRef(onPick), drawRef = useRef(false), watch = useRef<number | null>(null), last = useRef<maplibregl.LngLat | null>(null);
  const pin = useRef<maplibregl.Marker>(), extra = useRef<maplibregl.Marker[]>([]), found = useRef<Map<number, maplibregl.Marker>>(new Map());
  const data = useRef<Record<SrcId, FC>>({ declared: empty(), radius: empty(), drawn: empty(), draw: empty(), you: empty() });
  const [base, setBase] = useState<'street' | 'sat'>('street'), baseRef = useRef(base), fellBack = useRef(false);
  const [q, setQ] = useState(''), [hits, setHits] = useState<Hit[]>([]), [msg, setMsg] = useState(''), [live, setLive] = useState(false), [acc, setAcc] = useState<number | null>(null);
  const [drawOn, setDrawOn] = useState(false), [pts, setPts] = useState<Pt[]>([]);
  const drawing = (v: boolean) => { drawRef.current = v; setDrawOn(v); };
  pick.current = onPick;

  /** (Re)create our sources and layers. Runs after every style change, because switching map/satellite wipes them. */
  const addLayers = () => {
    const m = map.current!;
    SOURCES.forEach(id => { if (!m.getSource(id)) m.addSource(id, { type: 'geojson', data: data.current[id] }); else (m.getSource(id) as maplibregl.GeoJSONSource).setData(data.current[id]); });
    const has = (id: string) => !!m.getLayer(id);
    if (!has('declared-fill')) m.addLayer({ id: 'declared-fill', type: 'fill', source: 'declared', paint: { 'fill-color': '#2559D8', 'fill-opacity': 0.28 } });
    if (!has('declared-line')) m.addLayer({ id: 'declared-line', type: 'line', source: 'declared', paint: { 'line-color': '#2559D8', 'line-width': 2 } });
    if (!has('radius-line')) m.addLayer({ id: 'radius-line', type: 'line', source: 'radius', paint: { 'line-color': '#16A06A', 'line-width': 1.6, 'line-dasharray': [3, 3] } });
    if (!has('radius-fill')) m.addLayer({ id: 'radius-fill', type: 'fill', source: 'radius', paint: { 'fill-color': '#16A06A', 'fill-opacity': 0.05 } });
    if (!has('drawn-fill')) m.addLayer({ id: 'drawn-fill', type: 'fill', source: 'drawn', paint: { 'fill-color': '#F5A524', 'fill-opacity': 0.2 } });
    if (!has('drawn-line')) m.addLayer({ id: 'drawn-line', type: 'line', source: 'drawn', paint: { 'line-color': '#F5A524', 'line-width': 3 } });
    if (!has('draw-fill')) m.addLayer({ id: 'draw-fill', type: 'fill', source: 'draw', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#F5A524', 'fill-opacity': 0.16 } });
    if (!has('draw-line')) m.addLayer({ id: 'draw-line', type: 'line', source: 'draw', filter: ['!=', '$type', 'Point'], paint: { 'line-color': '#F5A524', 'line-width': 3, 'line-dasharray': [2, 2] } });
    if (!has('draw-pts')) m.addLayer({ id: 'draw-pts', type: 'circle', source: 'draw', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 5, 'circle-color': '#F5A524', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
    if (!has('you-fill')) m.addLayer({ id: 'you-fill', type: 'fill', source: 'you', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#2559D8', 'fill-opacity': 0.1 } });
    if (!has('you-dot')) m.addLayer({ id: 'you-dot', type: 'circle', source: 'you', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 8, 'circle-color': '#2559D8', 'circle-stroke-color': '#fff', 'circle-stroke-width': 3 } });
  };
  const setData = (id: SrcId, fc: FC) => { data.current[id] = fc; const s = map.current?.getSource(id) as maplibregl.GeoJSONSource | undefined; s?.setData(fc); };

  useEffect(() => {
    const m = new maplibregl.Map({ container: el.current!, style: STREET_STYLE, center: [lng, lat], zoom: 16, maxZoom: 20, attributionControl: { compact: true } });
    m.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    m.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    m.on('style.load', addLayers);
    // OpenFreeMap blocked or down on this network? Switch to the backup street map instead of showing a blank map.
    const fallback = () => { if (fellBack.current || baseRef.current !== 'street') return; fellBack.current = true; m.setStyle(esriStreetStyle()); setMsg(T('The main map could not be loaded here, so a backup map is shown.', 'முதன்மை வரைபடம் ஏற்றப்படவில்லை; மாற்று வரைபடம் காட்டப்படுகிறது.')); };
    let tileErrors = 0;
    m.on('error', e => { if (fellBack.current || baseRef.current !== 'street') return; const ev = e as { sourceId?: string }; if (!ev.sourceId) { if (!m.isStyleLoaded()) fallback(); } else if (++tileErrors >= 4) fallback(); });
    const guard = setTimeout(() => { if (!m.isStyleLoaded()) fallback(); }, 7000);
    m.once('idle', () => clearTimeout(guard));
    m.on('click', e => { if (drawRef.current) setPts(p => [...p, [e.lngLat.lat, e.lngLat.lng]]); else pick.current?.(e.lngLat.lat, e.lngLat.lng); });
    const mk = new maplibregl.Marker({ color: '#C0392B', draggable: !!pick.current }).setLngLat([lng, lat]).addTo(m);
    mk.on('dragend', () => { const p = mk.getLngLat(); pick.current?.(p.lat, p.lng); });
    pin.current = mk; map.current = m;
    return () => { if (watch.current !== null) navigator.geolocation.clearWatch(watch.current); m.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* map / satellite switch */
  useEffect(() => { if (baseRef.current === base) return; baseRef.current = base; map.current?.setStyle(base === 'sat' ? satStyle() : fellBack.current ? esriStreetStyle() : STREET_STYLE); }, [base]);

  /* pin, declared plot square, radius circle, nearby dots */
  useEffect(() => {
    const m = map.current!; pin.current?.setLngLat([lng, lat]);
    const side = Math.sqrt(sqft * 0.092903) / 2, dl = side / 111320, dn = side / (111320 * Math.cos((lat * Math.PI) / 180));
    setData('declared', { type: 'FeatureCollection', features: [poly([[lng - dn, lat - dl], [lng + dn, lat - dl], [lng + dn, lat + dl], [lng - dn, lat + dl]])] });
    setData('radius', radius ? { type: 'FeatureCollection', features: [circlePoly(lat, lng, radius)] } : empty());
    if (radius) { const dr = radius / 111320, dr2 = radius / (111320 * Math.cos((lat * Math.PI) / 180)); m.fitBounds([[lng - dr2, lat - dr], [lng + dr2, lat + dr]], { padding: 30, maxZoom: 16, duration: 600 }); }
    else if (!drawRef.current && !places?.length) m.easeTo({ center: [lng, lat], zoom: Math.max(m.getZoom(), 16), duration: 500 });
    extra.current.forEach(x => x.remove()); extra.current = [];
    Object.entries(nearby ?? {}).forEach(([k, list]) => list.forEach(i => {
      const d = document.createElement('div'); d.style.cssText = 'width:12px;height:12px;border-radius:50%;background:#E08A1E;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)';
      extra.current.push(new maplibregl.Marker({ element: d }).setLngLat([i.lng, i.lat]).setPopup(new maplibregl.Popup({ offset: 10 }).setText(`${i.name} · ${k.replace('_', ' ')} · ${i.km.toFixed(1)} km`)).addTo(m));
    }));
  }, [lat, lng, sqft, radius, nearby]); // eslint-disable-line react-hooks/exhaustive-deps

  /* numbered markers from the map assistant */
  useEffect(() => {
    const m = map.current!; found.current.forEach(x => x.remove()); found.current.clear();
    (places ?? []).forEach(p => {
      const d = document.createElement('div'); d.textContent = String(p.n); d.style.cssText = 'min-width:24px;height:24px;border-radius:12px;padding:0 6px;background:#0E7A55;color:#fff;font:700 12px/24px system-ui;text-align:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);cursor:pointer';
      const mk = new maplibregl.Marker({ element: d }).setLngLat([p.lng, p.lat]).setPopup(new maplibregl.Popup({ offset: 14 }).setHTML(`<b></b><br><span></span>`)).addTo(m);
      const pop = mk.getPopup()!.getElement?.(); void pop; // content set below (text only, never HTML from data)
      mk.getPopup()!.setDOMContent((() => { const w = document.createElement('div'); const b = document.createElement('b'); b.textContent = p.name; const s = document.createElement('div'); s.textContent = `${p.km.toFixed(1)} km straight line${p.roadKm ? ` · ${p.roadKm.toFixed(1)} km by road${p.mins ? ` (~${p.mins} min)` : ''}` : ''}`; w.append(b, s); return w; })());
      found.current.set(p.n, mk);
    });
    if (places?.length) { const b = new maplibregl.LngLatBounds([lng, lat], [lng, lat]); places.forEach(p => b.extend([p.lng, p.lat])); m.fitBounds(b, { padding: 60, maxZoom: 16, duration: 700 }); }
  }, [places]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (activePlace == null) return; const mk = found.current.get(activePlace), p = places?.find(x => x.n === activePlace); if (!mk || !p) return;
    map.current?.flyTo({ center: [p.lng, p.lat], zoom: 17, duration: 800 }); found.current.forEach(x => x.getPopup()?.isOpen() && x.togglePopup()); mk.togglePopup();
  }, [activePlace]); // eslint-disable-line react-hooks/exhaustive-deps

  /* plot drawing */
  useEffect(() => {
    map.current!.getCanvas().style.cursor = drawOn ? 'crosshair' : '';
    const f: GeoJSON.Feature[] = pts.map(p => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [p[1], p[0]] } }));
    if (pts.length >= 3) f.push(poly(pts.map(p => [p[1], p[0]] as [number, number])));
    else if (pts.length === 2) f.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts.map(p => [p[1], p[0]]) } });
    setData('draw', drawOn ? { type: 'FeatureCollection', features: f } : empty());
  }, [pts, drawOn]);
  useEffect(() => { setData('drawn', plot && !drawOn ? { type: 'FeatureCollection', features: [poly(plot.pts.map(p => [p[1], p[0]] as [number, number]))] } : empty()); }, [plot, drawOn]);

  /* GPS */
  const GOOD = 50;
  const stop = () => { if (watch.current !== null) { navigator.geolocation.clearWatch(watch.current); watch.current = null; } setLive(false); };
  const showYou = (p: GeolocationPosition) => {
    const { latitude: la, longitude: lo, accuracy } = p.coords; setAcc(Math.round(accuracy));
    setData('you', { type: 'FeatureCollection', features: [circlePoly(la, lo, accuracy), { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lo, la] } }] });
  };
  /** Live mode: ignore weak fixes (WiFi/IP guesses jump hundreds of metres) and jitter smaller than the accuracy. */
  const follow = (p: GeolocationPosition) => {
    showYou(p); const { latitude: la, longitude: lo, accuracy } = p.coords;
    if (accuracy > GOOD) return setMsg(T(`Weak GPS signal (±${Math.round(accuracy)} m), pin not moved. Go outdoors or use a phone; laptops have no GPS chip.`, `GPS சிக்னல் பலவீனம் (±${Math.round(accuracy)} மீ). வெளியே செல்லவும்; மொபைல் பயன்படுத்தவும்.`));
    const at = new maplibregl.LngLat(lo, la); if (last.current && last.current.distanceTo(at) < Math.max(5, accuracy * 0.5)) return;
    last.current = at; setMsg(''); pick.current?.(la, lo);
  };
  const geoErr = (e: GeolocationPositionError) => { stop(); setMsg(e.code === 1 ? T('Location permission is blocked. Allow it in the browser address bar.', 'இருப்பிட அனுமதி மறுக்கப்பட்டது. உலாவியில் அனுமதிக்கவும்.') : T('Could not get your location. Try outdoors or turn on GPS.', 'இருப்பிடம் கிடைக்கவில்லை. GPS ஐ இயக்கவும்.')); };
  /** One-shot: listen up to 12 s and keep the most accurate reading instead of the first (usually poor) one. */
  const here = () => {
    if (!navigator.geolocation) return setMsg(T('This device has no location support.', 'இந்த சாதனத்தில் இருப்பிட வசதி இல்லை.'));
    setMsg(T('Finding your exact location…', 'துல்லியமான இருப்பிடம் தேடுகிறது…')); let best: GeolocationPosition | null = null, tm: ReturnType<typeof setTimeout>;
    const done = () => {
      clearTimeout(tm); navigator.geolocation.clearWatch(id);
      if (!best) return setMsg(T('No location signal in 12 seconds. Desktops and laptops usually have no GPS. Search the village, paste coordinates, or use your phone.', '12 வினாடிகளில் சிக்னல் இல்லை. கிராமத்தை தேடவும், ஆயங்களை ஒட்டவும், அல்லது மொபைலை பயன்படுத்தவும்.'));
      showYou(best); const { latitude: la, longitude: lo, accuracy: a } = best.coords;
      if (a > 1000) { // area-level guess only: show the area, but do NOT drop the pin there
        const d = a / 111320; map.current?.fitBounds([[lo - d, la - d], [lo + d, la + d]], { padding: 30 });
        return setMsg(T(`This device only knows your general area (±${(a / 1000).toFixed(1)} km), so the pin was not moved. Search the village, paste coordinates, or open this page on your phone outdoors.`, `இந்த சாதனம் பொதுவான பகுதியை மட்டுமே அறியும் (±${(a / 1000).toFixed(1)} கி.மீ). கிராமத்தை தேடவும், ஆயங்களை ஒட்டவும், அல்லது மொபைலில் திறக்கவும்.`));
      }
      map.current?.flyTo({ center: [lo, la], zoom: 18 }); pick.current?.(la, lo);
      setMsg(a > 100 ? T(`Low accuracy (±${Math.round(a)} m). This device is guessing from WiFi/IP. Drag the pin onto the plot in satellite view, or use a phone outdoors.`, `குறைந்த துல்லியம் (±${Math.round(a)} மீ). செயற்கைக்கோள் வரைபடத்தில் பின்னை இழுத்து வைக்கவும்.`) : '');
    };
    const id = navigator.geolocation.watchPosition(p => { if (!best || p.coords.accuracy < best.coords.accuracy) { best = p; showYou(p); } if (p.coords.accuracy <= 20) done(); }, e => { clearTimeout(tm); navigator.geolocation.clearWatch(id); geoErr(e); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
    tm = setTimeout(done, 12000);
  };
  const toggleLive = () => {
    if (live) { stop(); setData('you', empty()); setAcc(null); setMsg(''); return; }
    if (!navigator.geolocation) return setMsg(T('This device has no location support.', 'இந்த சாதனத்தில் இருப்பிட வசதி இல்லை.'));
    setMsg(''); setLive(true); last.current = null;
    watch.current = navigator.geolocation.watchPosition(follow, geoErr, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  };

  /* search: "11.2721, 77.6784", a Google Maps link with coordinates, or a place name (Nominatim) */
  const parseCoords = (t: string): Pt | null => {
    const m = t.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ?? t.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ?? t.match(/^\s*(-?\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
    if (!m) return null; const a = +m[1], b = +m[2]; return Math.abs(a) <= 90 && Math.abs(b) <= 180 ? [a, b] : null;
  };
  const search = async () => {
    if (!q.trim()) return; setMsg(''); setHits([]);
    const c = parseCoords(q); if (c) { onPick?.(c[0], c[1]); return setMsg(T('Pin moved to those coordinates.', 'பின் அந்த ஆயங்களுக்கு நகர்ந்தது.')); }
    if (/^https?:\/\//.test(q.trim())) return setMsg(T('Short links cannot be read. Open the link, copy the full address-bar URL or the coordinates, and paste that.', 'குறுகிய இணைப்புகளை படிக்க முடியாது. முழு URL அல்லது ஆயங்களை ஒட்டவும்.'));
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=in&q=${encodeURIComponent(q.trim())}`, { headers: { 'Accept-Language': 'en' } });
      const j = (await r.json()) as Hit[]; setHits(j); if (!j.length) setMsg(T('No place found. Try the village and district name.', 'இடம் கிடைக்கவில்லை.'));
    } catch { setMsg(T('Search is not responding. Try again.', 'தேடல் பதிலளிக்கவில்லை.')); }
  };

  return <div>
    <div className="row wrap" style={{ gap: 8, marginBottom: 10 }}>
      {onPick && <>
        <input className="in" style={{ flex: '1 1 200px' }} placeholder={T('Search village, or paste coordinates / Google Maps link', 'கிராமம் தேடுக, அல்லது ஆயங்கள் / Google Maps இணைப்பு')} value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} aria-label="Search place" />
        <button className="btn o sm" onClick={search}>{T('Search', 'தேடு')}</button>
        <button className="btn o sm" onClick={here}>{T('My location', 'என் இருப்பிடம்')}</button>
        <button className={`btn sm ${live ? '' : 'o'}`} onClick={toggleLive} aria-pressed={live}>{live ? T('Live: ON (tap to stop)', 'நேரலை: ON') : T('Live follow', 'நேரலை')}</button>
      </>}
      <span className="row" style={{ gap: 0, marginLeft: 'auto' }} role="group" aria-label="Map type">
        <button className={`btn sm ${base === 'street' ? '' : 'o'}`} style={{ borderRadius: '10px 0 0 10px' }} onClick={() => setBase('street')} aria-pressed={base === 'street'}>{T('Map', 'வரைபடம்')}</button>
        <button className={`btn sm ${base === 'sat' ? '' : 'o'}`} style={{ borderRadius: '0 10px 10px 0' }} onClick={() => setBase('sat')} aria-pressed={base === 'sat'}>{T('Satellite', 'செயற்கைக்கோள்')}</button>
      </span>
    </div>
    {hits.length > 0 && <div className="panel" style={{ marginBottom: 8 }}>{hits.map(h => <button key={h.lat + h.lon} className="nav" style={{ width: '100%', textAlign: 'left' }} onClick={() => { onPick!(+h.lat, +h.lon); setHits([]); }}>{h.display_name}</button>)}</div>}
    {(msg || acc !== null) && <div className="mu sm" style={{ marginBottom: 8 }} role="status">{msg || T(`GPS accuracy about ${acc} m. The pin moves with you. Stand on the plot corner for best accuracy.`, `GPS துல்லியம் சுமார் ${acc} மீ.`)}</div>}
    {onPlot && <div style={{ marginBottom: 10 }}>
      <div className="row wrap" style={{ gap: 8 }}>
        {!drawOn ? <>
          <button className="btn o sm" onClick={() => { setPts([]); setBase('sat'); drawing(true); }}>{plot ? T('Redraw plot boundary', 'எல்லையை மீண்டும் வரை') : T('Draw plot boundary', 'நில எல்லையை வரை')}</button>
          {plot && <button className="btn o sm" onClick={() => onPlot(null)}>{T('Remove boundary', 'எல்லையை நீக்கு')}</button>}
        </> : <>
          <button className="btn sm" disabled={pts.length < 3} onClick={() => { onPlot({ pts, areaSqft: Math.round(polyAreaSqft(pts)) }); drawing(false); }}>{T('Finish', 'முடி')}</button>
          <button className="btn o sm" disabled={!pts.length} onClick={() => setPts(p => p.slice(0, -1))}>{T('Undo point', 'ஒரு புள்ளி பின்')}</button>
          <button className="btn o sm" disabled={!pts.length} onClick={() => setPts([])}>{T('Clear', 'அழி')}</button>
          <button className="btn o sm" onClick={() => drawing(false)}>{T('Cancel', 'ரத்து')}</button>
        </>}
      </div>
      <div className="mu sm" style={{ marginTop: 6 }} role="status">
        {drawOn ? (pts.length < 3 ? T(`Tap each corner of the plot on the map (${pts.length} so far, need 3 or more).`, `வரைபடத்தில் நிலத்தின் ஒவ்வொரு மூலையையும் தொடவும் (${pts.length}; குறைந்தது 3).`) : T('Area so far: ', 'இதுவரை பரப்பு: ') + fmtArea(polyAreaSqft(pts)))
          : plot ? <>{T('Drawn area: ', 'வரைந்த பரப்பு: ')}<b>{fmtArea(plot.areaSqft)}</b>{sqft > 0 && Math.abs(plot.areaSqft - sqft) / sqft > 0.1 && <span style={{ color: 'var(--amber, #B7791F)' }}> · {T(`differs from the declared extent (${Math.round(sqft).toLocaleString('en-IN')} sq ft) by ${Math.round(((plot.areaSqft - sqft) / sqft) * 100)}%`, `அறிவித்த பரப்பிலிருந்து ${Math.round(((plot.areaSqft - sqft) / sqft) * 100)}% வேறுபாடு`)}</span>}</>
          : T('Zoom to the plot in satellite view, then draw its boundary to measure the area.', 'செயற்கைக்கோள் காட்சியில் நிலத்தை பெரிதாக்கி எல்லையை வரைந்து பரப்பை அளக்கவும்.')}
      </div>
    </div>}
    <div ref={el} className="map" style={{ height, borderRadius: 14, overflow: 'hidden' }} />
  </div>;
}
