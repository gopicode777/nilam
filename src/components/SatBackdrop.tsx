import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { SAT_ATTRIBUTION, satStyle } from '../lib/tiles';

/**
 * Live satellite background for the landing page (real imagery tiles, not a video file, so it is always sharp).
 *  variant "hero":  a spinning globe settles on South India, then dives with a tilted camera onto a Tamil Nadu town,
 *                   draws a survey-plot outline, orbits it, lifts off and flies to the next place.
 *  variant "drift": slow orbit around one plot. Only runs while the section is on screen.
 * Static (one frame) when the visitor prefers reduced motion or has Data Saver on.
 */
const PLACES: { c: [number, number] }[] = [
  { c: [79.9086, 13.1439] }, { c: [76.9558, 11.0168] }, { c: [78.1198, 9.9252] }, { c: [78.7047, 10.7905] }, { c: [79.1325, 12.9165] }, { c: [79.1378, 10.787] },
];
const pinEl = () => { const d = document.createElement('div'); d.className = 'sat-pin'; d.innerHTML = '<i></i>'; return d; };
const plotRing = (c: [number, number]): [number, number][] => { const d = 0.00055; return [[c[0] - d * 1.3, c[1] - d], [c[0] + d * 1.2, c[1] - d * 0.7], [c[0] + d, c[1] + d * 0.9], [c[0] - d * 0.9, c[1] + d]]; };

export default function SatBackdrop({ variant = 'hero' }: { variant?: 'hero' | 'drift' }) {
  const box = useRef<HTMLDivElement>(null), el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches || (navigator as unknown as { connection?: { saveData?: boolean } }).connection?.saveData;
    const small = matchMedia('(max-width: 700px)').matches, hero = variant === 'hero';
    const style = (hero && !small ? { ...satStyle(), projection: { type: 'globe' } } : satStyle()) as maplibregl.StyleSpecification;
    const m = new maplibregl.Map({ container: el.current!, style, center: hero ? [20, 15] : PLACES[1].c, zoom: hero ? (small ? 3 : 1.3) : 17, pitch: 0, interactive: false, attributionControl: false, maxPitch: 75 });
    let alive = true, started = false; const timers: ReturnType<typeof setTimeout>[] = []; let mk: maplibregl.Marker | null = null;
    const at = (ms: number, f: () => void) => timers.push(setTimeout(() => alive && f(), ms));
    const setPlot = (ring: [number, number][], progress: number, fill: boolean) => {
      const src = m.getSource('plot') as maplibregl.GeoJSONSource | undefined; if (!src) return;
      const n = Math.max(2, Math.round(ring.length * progress)), pts = ring.slice(0, n).concat(progress >= 1 ? [ring[0]] : []);
      src.setData({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts } }, ...(fill ? [{ type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [[...ring, ring[0]]] } }] : [])] });
    };
    const setup = () => {
      m.addSource('plot', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({ id: 'plot-fill', type: 'fill', source: 'plot', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#3BE0A0', 'fill-opacity': 0.2 } });
      m.addLayer({ id: 'plot-line', type: 'line', source: 'plot', paint: { 'line-color': '#3BE0A0', 'line-width': 3 } });
    };
    const drawPlot = (c: [number, number]) => {
      const ring = plotRing(c); mk?.remove(); mk = new maplibregl.Marker({ element: pinEl() }).setLngLat(c).addTo(m);
      [0.25, 0.5, 0.75, 1].forEach((p, i) => at(i * 650, () => setPlot(ring, p, p === 1)));
    };
    const clearPlot = () => { mk?.remove(); mk = null; (m.getSource('plot') as maplibregl.GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: [] }); };

    const heroLoop = (i: number, first: boolean) => {
      const c = PLACES[i % PLACES.length].c, bearing = -40 + Math.random() * 80;
      if (first) m.flyTo({ center: [78.4, 11.2], zoom: small ? 5 : 4.6, duration: 6500, essential: true });
      at(first ? 6600 : 0, () => m.flyTo({ center: c, zoom: 17, pitch: small ? 45 : 62, bearing, duration: 9000, curve: 1.5, essential: true }));
      const t0 = (first ? 6600 : 0) + 9300;
      at(t0, () => { drawPlot(c); m.easeTo({ bearing: bearing + 55, duration: 9000, easing: t => t, essential: true }); });
      at(t0 + 9300, () => { clearPlot(); m.flyTo({ center: [c[0] + 0.35, c[1] + 0.25], zoom: 6.2, pitch: 0, bearing: 0, duration: 6000, essential: true }); });
      at(t0 + 9300 + 6200, () => heroLoop(i + 1, false));
    };
    const drift = () => { const orbit = () => alive && m.easeTo({ bearing: m.getBearing() + 90, duration: 30000, easing: t => t, essential: true }); m.on('moveend', orbit); m.jumpTo({ pitch: 58, bearing: -20 }); orbit(); at(1200, () => drawPlot(PLACES[1].c)); };
    const start = () => { if (started || !alive) return; started = true; if (hero) heroLoop(0, true); else drift(); };

    m.on('load', () => {
      setup();
      if (still) { m.jumpTo({ center: PLACES[0].c, zoom: 16.5, pitch: 0 }); return; }
      if (hero) start();
    });
    let io: IntersectionObserver | undefined;
    if (!hero && !still) { io = new IntersectionObserver(([e]) => { if (e.isIntersecting && m.loaded()) start(); else if (e.isIntersecting) m.once('load', start); else if (started) { m.stop(); } }, { threshold: 0.2 }); io.observe(box.current!); }
    return () => { alive = false; timers.forEach(clearTimeout); io?.disconnect(); m.stop(); m.remove(); };
  }, [variant]);
  return <div className="sat-bg" aria-hidden="true" ref={box}><div ref={el} className="sat-map" /><div className="sat-shade" /><span className="sat-attr">{SAT_ATTRIBUTION}</span></div>;
}
