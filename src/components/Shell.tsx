import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { useStore } from '../store';
import { useL } from '../i18n';
import { Icon, IC, Logo, Tag } from '../ui';
import * as api from '../api';

export function LangSwitch() {
  const { lang } = useStore();
  return <select className="in" style={{ width: 'auto', padding: '5px 8px' }} aria-label="Language" value={lang} onChange={e => api.setLang(e.target.value as 'en' | 'ta')}><option value="en">English</option><option value="ta">தமிழ்</option></select>;
}
/** Fades the old page out, then the new one in. Keyed on the first two path segments so switching tabs inside a case does not re-animate the whole workspace. */
function Transition() {
  const loc = useLocation(), outlet = useOutlet(), key = '/' + loc.pathname.split('/').slice(1, 3).join('/'), [shown, setShown] = useState(key), [phase, setPhase] = useState<'in' | 'out'>('in'), last = useRef(outlet);
  useEffect(() => { if (key === shown) return; setPhase('out'); const t = setTimeout(() => { setShown(key); setPhase('in'); window.scrollTo(0, 0); }, 150); return () => clearTimeout(t); }, [key]); // eslint-disable-line
  const el = key === shown ? outlet : last.current; last.current = el;
  return <div key={shown} className={`page ${phase === 'out' ? 'out' : ''}`}>{el}</div>;
}
function Search() {
  const s = useStore(), { L } = useL(), nav = useNavigate(), [q, setQ] = useState(''), [open, setOpen] = useState(false), u = s.users.find(x => x.id === s.session)!;
  const hits = q.trim().length < 1 ? [] : s.cases.filter(c => (u.role === 'admin' || c.ownerId === u.id) && `${c.id} ${c.village} ${c.district} ${c.survey} ${c.seller}`.toLowerCase().includes(q.toLowerCase())).slice(0, 5);
  return <div className="srch"><Icon d={IC.search} /><input value={q} onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} placeholder={L('Search a case, village or survey no.', 'வழக்கு, கிராமம், சர்வே எண் தேடுக')} />
    {open && q && <div className="dd">{hits.length ? hits.map(c => <a key={c.id} onMouseDown={() => { nav(`/cases/${c.id}`); setQ(''); }}>{c.village || c.district}, {c.district} <span className="mu mono">S.No {c.survey}</span></a>) : <div className="mu" style={{ padding: 10 }}>{L('No match', 'பொருத்தம் இல்லை')}</div>}</div>}</div>;
}
export default function Shell() {
  const s = useStore(), { L } = useL(), nav = useNavigate(), u = s.users.find(x => x.id === s.session)!;
  const items = [
    ['/', IC.grid, L('Dashboard', 'முகப்பு')], ['/new', IC.plus, L('New audit', 'புதிய தணிக்கை')], ['/compare', IC.layers, L('Compare plots', 'நிலங்களை ஒப்பிடு')], ['/professionals', IC.users, L('Professionals', 'நிபுணர்கள்')], ['/plans', IC.card, L('Plans & credits', 'திட்டங்கள் & கிரெடிட்')], ['/settings', IC.cog, L('Settings', 'அமைப்புகள்')],
  ];
  const admin = [['/admin', IC.grid, L('Overview', 'மேலோட்டம்')], ['/admin/users', IC.users, L('Users', 'பயனர்கள்')], ['/admin/cases', IC.file, L('All cases', 'அனைத்து வழக்குகள்')], ['/admin/reviews', IC.check, L('Review queue', 'மதிப்பாய்வு வரிசை')], ['/admin/analytics', IC.chart, L('Analytics', 'பகுப்பாய்வு')], ['/admin/rules', IC.cog, L('Score rules', 'மதிப்பெண் விதிகள்')], ['/admin/sources', IC.db, L('Data sources', 'தரவு மூலங்கள்')], ['/admin/logs', IC.log, L('Audit logs', 'செயல் பதிவுகள்')]];
  const link = (x: string[]) => <NavLink key={x[0]} to={x[0]} end={x[0] === '/' || x[0] === '/admin'} className={({ isActive }) => 'nav' + (isActive ? ' on' : '')}><Icon d={x[1]} />{x[2]}</NavLink>;
  const all = u.role === 'admin' ? admin : items;
  return (
    <div className="shell">
      <aside className="side">
        <div style={{ padding: '2px 10px 18px' }}><Link to="/" style={{ textDecoration: 'none' }}><Logo /></Link></div>
        {u.role === 'admin' ? <><div className="nav-h">{L('Admin', 'நிர்வாகம்')}</div>{admin.map(link)}<div className="nav-h">{L('Product', 'தயாரிப்பு')}</div>{items.map(link)}</> : items.map(link)}
        <div className="sp" />
        <a className="nav" href="admin.html" target="_blank" rel="noreferrer"><Icon d={IC.chart} />{L('Admin analytics', 'நிர்வாக பகுப்பாய்வு')}</a>
        <button className="nav" onClick={() => { api.logout(); nav('/login'); }}><Icon d={IC.out} />{L('Log out', 'வெளியேறு')}</button>
      </aside>
      <div className="main">
        <div className="mnav">{[...all, ...(u.role === 'admin' ? items : [])].map(link)}</div>
        <header className="top">
          <Search /><div className="sp" />
          <LangSwitch />
          <button className="btn o sm" onClick={api.toggleTheme} aria-label="Theme"><Icon d={IC.moon} /></button>
          {u.role !== 'admin' && <><Tag tone="b">{u.credits} {L('credits', 'கிரெடிட்')}</Tag><Link className="btn gr sm" to="/plans">{L('Upgrade', 'மேம்படுத்து')}</Link></>}
          <div className="av" title={u.email}>{u.name[0]?.toUpperCase()}</div>
        </header>
        <Transition />
      </div>
    </div>
  );
}
