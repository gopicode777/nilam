import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { useL } from '../i18n';
import * as api from '../api';

/**
 * First-login flow: welcome slides, then a guided tour that highlights menu items and cards one at a time.
 * Shown once per user (saved in profiles.onboarding). The ? button in the top bar replays the tour.
 * Targets are found with data-tour="..." attributes; steps whose target is not on screen are skipped.
 */
const find = (t: string) => [...document.querySelectorAll<HTMLElement>(`[data-tour="${t}"]`)].find(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
interface Step { t: string; h: string; p: string }
type Box = { l: number; t: number; w: number; h: number };

export default function Onboarding() {
  const s = useStore(), { L } = useL(), nav = useNavigate(), loc = useLocation(), u = s.users.find(x => x.id === s.session);
  const [phase, setPhase] = useState<'none' | 'welcome' | 'tour'>('none'), [slide, setSlide] = useState(0), [list, setList] = useState<Step[]>([]), [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null), [pos, setPos] = useState<{ l: number; t: number }>({ l: 12, t: 12 }), tip = useRef<HTMLDivElement>(null), auto = useRef(false);

  const slides = [
    ['🏞️', L('Check the land before you pay', 'பணம் கொடுக்கும் முன் நிலத்தை சரிபார்க்கவும்'), L('Upload the sale deed, patta and EC. LandAudit compares them with each other and with map data.', 'விற்பனை பத்திரம், பட்டா, வில்லங்க சான்றிதழை பதிவேற்றவும். LandAudit அவற்றை ஒன்றோடொன்றும் வரைபட தரவோடும் ஒப்பிடும்.')],
    ['📄', L('We read, you confirm', 'நாங்கள் படிக்கிறோம், நீங்கள் உறுதி செய்கிறீர்கள்'), L('Values are read from your files by AI. You review each one, so a reading mistake never becomes a wrong score.', 'AI உங்கள் கோப்புகளிலிருந்து மதிப்புகளை படிக்கும். நீங்கள் ஒவ்வொன்றையும் சரிபார்ப்பதால் வாசிப்பு தவறு தவறான மதிப்பெண்ணாகாது.')],
    ['🧭', L('Score, findings, next steps', 'மதிப்பெண், கண்டறிதல்கள், அடுத்த படிகள்'), L('See what matches, what does not and what nobody has checked yet, with the exact next step.', 'எது பொருந்துகிறது, எது இல்லை, எது இன்னும் சரிபார்க்கப்படவில்லை என்பதை அடுத்த படியுடன் பாருங்கள்.')],
    ['📍', L('Ask the map', 'வரைபடத்திடம் கேளுங்கள்'), L('Drop a pin and ask about hospitals, schools or PG hostels around it.', 'பின் வைத்து சுற்றியுள்ள மருத்துவமனைகள், பள்ளிகள், PG விடுதிகள் பற்றி கேளுங்கள்.')],
  ];
  const steps: Step[] = [
    { t: '/new', h: L('Start here', 'இங்கே தொடங்குங்கள்'), p: L('Add a property: district, village and survey number. Every audit starts here.', 'சொத்தை சேர்க்கவும்: மாவட்டம், கிராமம், சர்வே எண். ஒவ்வொரு தணிக்கையும் இங்கே தொடங்கும்.') },
    { t: 'cases', h: L('Your cases and the next step', 'உங்கள் வழக்குகளும் அடுத்த படியும்'), p: L('Each property is a case. The last column always tells you what to do next.', 'ஒவ்வொரு சொத்தும் ஒரு வழக்கு. கடைசி நெடுவரிசை அடுத்து என்ன செய்வது என்று சொல்லும்.') },
    { t: 'checklist', h: L('Your get-started checklist', 'தொடக்க சரிபார்ப்பு பட்டியல்'), p: L('It ticks itself as you go: add a property, upload documents, confirm values, run the audit.', 'நீங்கள் செய்யச் செய்ய தானாக டிக் ஆகும்: சொத்து சேர்த்தல், ஆவணங்கள், மதிப்புகள் உறுதி, தணிக்கை.') },
    { t: '/map', h: L('Map assistant', 'வரைபட உதவியாளர்'), p: L('Drop a pin and ask: hospitals within 3 km? PG hostels nearby? Answers come from map data.', 'பின் வைத்து கேளுங்கள்: 3 கி.மீ-க்குள் மருத்துவமனைகள்? அருகில் PG விடுதிகள்? பதில்கள் வரைபட தரவிலிருந்து வரும்.') },
    { t: '/compare', h: L('Compare plots', 'நிலங்களை ஒப்பிடுங்கள்'), p: L('Put two or more audited plots side by side before you decide.', 'முடிவெடுக்கும் முன் தணிக்கை செய்த நிலங்களை அருகருகே ஒப்பிடுங்கள்.') },
    { t: '/professionals', h: L('Need an expert?', 'நிபுணர் வேண்டுமா?'), p: L('Request an advocate, surveyor, planner or valuer review for any case.', 'எந்த வழக்குக்கும் வழக்கறிஞர், சர்வேயர், திட்டமிடுபவர், மதிப்பீட்டாளர் ஆய்வை கோரலாம்.') },
    { t: 'credits', h: L('Your credits', 'உங்கள் கிரெடிட்கள்'), p: L('Each case uses one credit the first time you run its audit. Running it again is free.', 'ஒவ்வொரு வழக்கும் முதல் தணிக்கையில் ஒரு கிரெடிட் எடுக்கும். மீண்டும் இயக்குவது இலவசம்.') },
    { t: 'help', h: L('Need this again?', 'இது மீண்டும் வேண்டுமா?'), p: L('Press ? any time to replay this tour.', 'எப்போது வேண்டுமானாலும் ? அழுத்தி இந்த சுற்றுப்பயணத்தை மீண்டும் பாருங்கள்.') },
  ];

  const stop = (done = true) => { setPhase('none'); setBox(null); if (done) api.setOnboarding({ welcome: true, tour: true }); };
  const startTour = useCallback(() => {
    if (window.location.hash.replace('#', '') !== '/') nav('/');
    setTimeout(() => { const l = steps.filter(x => find(x.t)); if (!l.length) return; setList(l); setI(0); setPhase('tour'); }, 450);
  }, [nav, L]); // eslint-disable-line react-hooks/exhaustive-deps

  // first login: welcome slides (customers only; admins can replay with ?)
  useEffect(() => {
    if (!u || u.role === 'admin' || auto.current || u.onboarding?.welcome) return;
    auto.current = true; const t = setTimeout(() => { if (loc.pathname === '/') setPhase('welcome'); else auto.current = false; }, 800); return () => clearTimeout(t);
  }, [u?.id, u?.onboarding?.welcome, loc.pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  // the ? button in the top bar
  useEffect(() => { const f = () => startTour(); window.addEventListener('la-tour', f); return () => window.removeEventListener('la-tour', f); }, [startTour]);

  const measure = useCallback(() => {
    const st = list[i]; const el = st && find(st.t); if (!el) return;
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const r = el.getBoundingClientRect(); setBox({ l: r.left, t: r.top, w: r.width, h: r.height });
  }, [list, i]);
  useLayoutEffect(() => { if (phase === 'tour') measure(); }, [phase, measure]);
  useEffect(() => { if (phase !== 'tour') return; const f = () => measure(); window.addEventListener('resize', f); window.addEventListener('scroll', f, true); return () => { window.removeEventListener('resize', f); window.removeEventListener('scroll', f, true); }; }, [phase, measure]);
  useLayoutEffect(() => { // place the card to the right of the target, else below, else above, always inside the screen
    if (phase !== 'tour' || !box || !tip.current) return;
    const w = tip.current.offsetWidth, h = tip.current.offsetHeight; let l = box.l + box.w + 16, t = box.t;
    if (l + w > innerWidth - 12) { l = Math.max(12, Math.min(box.l, innerWidth - w - 12)); t = box.t + box.h + 14; }
    if (t + h > innerHeight - 12) t = Math.max(12, box.t - h - 14);
    setPos({ l, t });
  }, [phase, box, i]);
  useEffect(() => { // keyboard: Esc skips, arrows move
    if (phase === 'none') return;
    const f = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stop();
      if (phase === 'tour' && e.key === 'ArrowRight') next(); if (phase === 'tour' && e.key === 'ArrowLeft' && i) setI(i - 1);
      if (phase === 'welcome' && e.key === 'ArrowRight') slideNext();
    };
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => { if (i >= list.length - 1) stop(); else setI(i + 1); };
  const slideNext = () => { if (slide >= slides.length - 1) { api.setOnboarding({ welcome: true }); setPhase('none'); startTour(); } else setSlide(slide + 1); };

  if (phase === 'welcome') return <div className="ob-veil" role="dialog" aria-modal="true" aria-label={L('Welcome', 'வரவேற்பு')}>
    <div className="ob-modal">
      <div className="ob-art"><span key={slide}>{slides[slide][0]}</span></div>
      <div className="ob-body">
        <h2>{slides[slide][1]}</h2><p>{slides[slide][2]}</p>
        <div className="ob-dots">{slides.map((_, k) => <i key={k} className={k === slide ? 'on' : ''} />)}</div>
        <div className="ob-acts">
          <button className="ob-skip" onClick={() => stop()}>{L('Skip', 'தவிர்')}</button>
          <button className="btn o" style={{ visibility: slide ? 'visible' : 'hidden' }} onClick={() => setSlide(slide - 1)}>{L('Back', 'பின்')}</button>
          <button className="btn" autoFocus onClick={slideNext}>{slide === slides.length - 1 ? L('Show me around', 'சுற்றிக் காட்டு') : L('Next', 'அடுத்து')}</button>
        </div>
      </div>
    </div>
  </div>;

  if (phase === 'tour' && list[i]) {
    const st = list[i];
    return <>
      <div className="ob-block" />
      {box && <div className="ob-hl" style={{ left: box.l - 6, top: box.t - 6, width: box.w + 12, height: box.h + 12 }} />}
      <div className="ob-tip" ref={tip} style={{ left: pos.l, top: pos.t, visibility: box ? 'visible' : 'hidden' }} role="dialog" aria-label={st.h}>
        <h4>{st.h}</h4><p>{st.p}</p>
        <div className="ob-dots">{list.map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}</div>
        <div className="ob-acts">
          <button className="ob-skip" onClick={() => stop()}>{L('Skip tour', 'சுற்றுப்பயணத்தை தவிர்')}</button>
          <button className="btn o sm" style={{ visibility: i ? 'visible' : 'hidden' }} onClick={() => setI(i - 1)}>{L('Back', 'பின்')}</button>
          <button className="btn sm" autoFocus onClick={next}>{i === list.length - 1 ? L('Done', 'முடிந்தது') : L('Next', 'அடுத்து')}</button>
        </div>
      </div>
    </>;
  }
  return null;
}
