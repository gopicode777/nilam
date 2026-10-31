import { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useL } from '../i18n';
import { Ring } from '../ui';
const SatBackdrop = lazy(() => import('./SatBackdrop')); // map library loads after the form is on screen

/** Left panel of the login / register pages: live satellite dive over Tamil Nadu with a typed example of the map assistant. */
function useTyped(text: string, start: number, speed: number) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0); const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => { let i = 0; const t = setInterval(() => { i++; setN(i); if (i >= text.length) clearInterval(t); }, speed); timers.push(t); }, start));
    return () => timers.forEach(x => { clearTimeout(x); clearInterval(x); });
  }, [text, start, speed]);
  return text.slice(0, n);
}

/** Keeps the card above the headline: it shrinks to the space between the top of the panel and the headline, so the two never overlap on any screen height. */
function Fit({ children }: { children: ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const fit = () => {
      const w = wrap.current; if (!w) return;
      const hero = w.closest('.hero') as HTMLElement | null, copy = hero?.querySelector('.auth-copy') as HTMLElement | null;
      w.style.transform = 'none';
      const limit = copy && hero ? copy.getBoundingClientRect().top - hero.getBoundingClientRect().top - 20 : (hero?.clientHeight ?? 700) - 300, avail = limit - 96, h = w.offsetHeight;
      w.style.transform = `scale(${Math.max(0.5, Math.min(1, avail / Math.max(h, 1)))})`;
    };
    fit(); const ro = new ResizeObserver(fit); ro.observe(wrap.current!); ro.observe(document.body); window.addEventListener('resize', fit);
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  });
  return <div className="as-fit" ref={wrap}>{children}</div>;
}

/** Register panel: a sample audit running step by step. */
function AuditDemo() {
  const { L } = useL(), [step, setStep] = useState(0);
  useEffect(() => { const t = setInterval(() => setStep(s => (s + 1) % 8), 1100); return () => clearInterval(t); }, []);
  const rows: [string, string, 'ok' | 'warn'][] = [
    [L('Reading sale deed', 'விற்பனை பத்திரம் படிக்கிறது'), L('Seller and survey no. found', 'விற்பவர், சர்வே எண் கிடைத்தது'), 'ok'],
    [L('Comparing with patta', 'பட்டாவுடன் ஒப்பீடு'), L('Names and extent match', 'பெயர், பரப்பு பொருந்துகிறது'), 'ok'],
    [L('Checking encumbrance', 'வில்லங்கம் சரிபார்ப்பு'), L('2 entries need a discharge proof', '2 பதிவுகளுக்கு விடுவிப்பு ஆதாரம் வேண்டும்'), 'warn'],
    [L('Reading map data', 'வரைபட தரவு'), L('Hospital 1.2 km, bus stop 300 m', 'மருத்துவமனை 1.2 கி.மீ, பேருந்து 300 மீ'), 'ok'],
  ];
  return <div className="as-demo"><Fit><div className="as-card">
    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}><b>{L('Audit in progress', 'தணிக்கை நடக்கிறது')}</b><span className="as-note" style={{ position: 'static' }}>{L('Sample', 'மாதிரி')}</span></div>
    {rows.map(([a, b, t], i) => <div key={i} className={`as-row ${step > i ? 'as-on' : ''}`}><span className={`as-dot ${step > i ? t : ''}`}>{step > i ? (t === 'ok' ? '✓' : '!') : ''}</span><div><b>{a}</b><div className="sm">{step > i ? b : '…'}</div></div></div>)}
    <div className={`as-score ${step >= 5 ? 'as-on' : ''}`}><Ring v={step >= 5 ? 82 : 0} size={70} /><div><b>{L('Readiness', 'தயார்நிலை')}</b><div className="sm">{L('Verify the flagged items first', 'குறிக்கப்பட்டவற்றை முதலில் சரிபார்க்கவும்')}</div></div></div>
  </div></Fit></div>;
}

function ChatTeaser() {
  const { L } = useL();
  const q = L('Hospitals within 3 km?', '3 கி.மீ-க்குள் மருத்துவமனைகள்?');
  const a = L('1. Government Hospital: 1.2 km by road\n2. City Clinic: 2.4 km by road\nBased on OpenStreetMap data.', '1. அரசு மருத்துவமனை: சாலையில் 1.2 கி.மீ\n2. சிட்டி கிளினிக்: சாலையில் 2.4 கி.மீ\nOpenStreetMap தரவின் அடிப்படையில்.');
  const tq = useTyped(q, 900, 45), ta = useTyped(a, 900 + q.length * 45 + 700, 22);
  return <div className="as-demo"><Fit><div className="as-card as-chat">
    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}><b>{L('Ask about this place', 'இந்த இடத்தைப் பற்றி கேளுங்கள்')}</b><span className="as-note" style={{ position: 'static' }}>{L('Example', 'எடுத்துக்காட்டு')}</span></div>
    <div className="as-msg u">{tq}<i className="as-caret" /></div>
    {ta && <div className="as-msg">{ta}</div>}
  </div></Fit></div>;
}

/** side: "chat" for log in, "audit" for create account. Both sit on the same live satellite dive. */
export default function AuthSide({ side = 'chat' }: { side?: 'chat' | 'audit' }) {
  const [wide, setWide] = useState(() => matchMedia('(min-width: 901px)').matches), [round, setRound] = useState(0);
  useEffect(() => { const m = matchMedia('(min-width: 901px)'), f = () => setWide(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  useEffect(() => { const t = setInterval(() => setRound(r => r + 1), 16000); return () => clearInterval(t); }, []); // replay the example
  if (!wide) return null; // phones get the form only, so no map is loaded
  return <div className="auth-side" aria-hidden="true">
    <Suspense fallback={null}><SatBackdrop variant="hero" intro={false} /></Suspense>
    {side === 'audit' ? <AuditDemo /> : <ChatTeaser key={round} />}
  </div>;
}
