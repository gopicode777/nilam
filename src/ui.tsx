import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useL } from './i18n';
import type { Sev } from './types';

export const Tag = ({ tone = '', children }: { tone?: '' | 'a' | 'r' | 'b' | 'n'; children: ReactNode }) => <span className={`tag ${tone}`}>{children}</span>;
export const sevTone = (s: Sev): 'r' | 'a' | 'b' | 'n' => (s === 'critical' || s === 'high' ? 'r' : s === 'medium' ? 'a' : s === 'low' ? 'b' : 'n');
export function useSev() { const { L } = useL(); return (s: Sev) => ({ critical: L('Critical', 'மிக முக்கியம்'), high: L('High', 'உயர்'), medium: L('Medium', 'நடுத்தரம்'), low: L('Low', 'குறைவு'), info: L('Info', 'தகவல்') }[s]); }

/** Provenance label. Every data point says where it came from and how fresh it is. */
export function Prov({ kind, at }: { kind: 'user' | 'live' | 'manual' | 'none'; at?: string }) {
  const { L, lang } = useL();
  if (kind === 'user') return <Tag tone="n">{L('User uploaded', 'பயனர் பதிவேற்றம்')}</Tag>;
  if (kind === 'manual') return <Tag>{L('Confirmed by you', 'நீங்கள் உறுதி செய்தது')}</Tag>;
  if (kind === 'none' || !at) return <Tag tone="a">{L('Not verified', 'சரிபார்க்கப்படவில்லை')}</Tag>;
  const mins = (Date.now() - new Date(at).getTime()) / 6e4;
  if (mins < 10) return <Tag tone="b">{L('Live', 'நேரடி')} · {Math.max(1, Math.round(mins))} {L('min ago', 'நிமி முன்')}</Tag>;
  if (mins < 1440) return <Tag tone="b">{L('Recent', 'சமீபத்திய')} · {Math.round(mins / 60)} {L('h ago', 'ம முன்')}</Tag>;
  return <Tag tone="n">{L('Data as of', 'தரவு நாள்')} {new Date(at).toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-IN')}</Tag>;
}
export function useInView<T extends Element>() {
  const ref = useRef<T>(null), [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (!('IntersectionObserver' in window)) { setOn(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.25 }); io.observe(el); return () => io.disconnect();
  }, []);
  return [ref, on] as const;
}
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Counts up to a number when it scrolls into view. */
export function Num({ v, dur = 1000, pre = '', suf = '' }: { v: number; dur?: number; pre?: string; suf?: string }) {
  const [ref, on] = useInView<HTMLSpanElement>(), [n, setN] = useState(0);
  useEffect(() => {
    if (!on) return; if (reduced()) { setN(v); return; }
    let raf = 0, t0 = 0; const f = (t: number) => { if (!t0) t0 = t; const p = Math.min(1, (t - t0) / dur); setN(Math.round(v * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(f); };
    raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf);
  }, [on, v, dur]);
  return <span ref={ref}>{pre}{n.toLocaleString('en-IN')}{suf}</span>;
}
/** Adds .in to every .rv element as it enters the viewport (scroll reveal). */
export function useReveal() {
  useEffect(() => {
    const els = [...document.querySelectorAll('.rv')]; if (reduced() || !('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach(e => io.observe(e)); return () => io.disconnect();
  });
}
export function Ring({ v, tone = 'ok', size = 120 }: { v: number; tone?: 'ok' | 'warn' | 'bad'; size?: number }) {
  const col = tone === 'ok' ? 'var(--g)' : tone === 'warn' ? '#E0A020' : 'var(--rd)', [ref, on] = useInView<SVGSVGElement>();
  return <svg ref={ref} viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`${v}/100`}><circle cx="50" cy="50" r="43" fill="none" stroke="var(--line)" strokeWidth="9" /><circle cx="50" cy="50" r="43" fill="none" stroke={col} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${on ? 2.7 * v : 0} 270`} transform="rotate(-90 50 50)" style={{ transition: 'stroke-dasharray 1.3s cubic-bezier(.2,.7,.2,1) .15s' }} /><foreignObject x="0" y="0" width="100" height="100"><div style={{ height: '100%', display: 'grid', placeItems: 'center', textAlign: 'center', lineHeight: 1 }}><div><div style={{ fontSize: 27, fontWeight: 600, letterSpacing: '-.04em', color: 'var(--ink)' }}><Num v={v} /></div><div style={{ fontSize: 8.5, color: 'var(--mu)', marginTop: 2 }}>/100</div></div></div></foreignObject></svg>;
}
export const Empty = ({ title, hint, children }: { title: string; hint?: string; children?: ReactNode }) => <div style={{ padding: '36px 20px', textAlign: 'center' }}><b>{title}</b>{hint && <p className="mu" style={{ margin: '4px 0 14px' }}>{hint}</p>}{children}</div>;
export const date = (iso: string, lang: 'en' | 'ta') => new Date(iso).toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
export const inr = (n: number) => '₹' + n.toLocaleString('en-IN');
export const Icon = ({ d }: { d: string }) => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
export const IC = { grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z', plus: 'M12 5v14M5 12h14', card: 'M3 6h18v12H3zM3 10h18', users: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 19v-1a4 4 0 0 0-3-3.9', file: 'M7 3h7l5 5v13H7zM14 3v5h5', db: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6', check: 'M5 12l5 5L20 7', log: 'M4 5h16M4 12h16M4 19h10', out: 'M10 4H4v16h6M15 8l4 4-4 4M19 12H9', layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5', cog: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z', chart: 'M4 20V10M10 20V4M16 20v-8M22 20H2', moon: 'M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z', search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3', pin: 'M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z' };

export const Logo = ({ light }: { light?: boolean }) => (
  <span className="brand" style={{ color: light ? '#fff' : undefined }}>
    <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M5 9l10-5 12 6-2 14-11 5-9-8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><circle cx="16" cy="16" r="3.2" fill="currentColor" /></svg>LandAudit
  </span>
);

/** Slowly rotating survey-contour rings used as a background. */
export const Contours = () => (
  <svg className="cont" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    {[[400, 300, 120, 70, -12], [400, 300, 190, 120, 8], [400, 300, 270, 175, -20], [400, 300, 360, 235, 14], [400, 300, 450, 300, -6], [400, 300, 560, 380, 18]].map((e, i) => <ellipse key={i} cx={e[0]} cy={e[1]} rx={e[2]} ry={e[3]} transform={`rotate(${e[4]} 400 300)`} />)}
  </svg>
);
