import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store';
import { useL } from '../i18n';
import { Empty, Num, Tag, date, inr } from '../ui';
import * as api from '../api';
import type { Cat, Cfg, Review, Sev } from '../types';
import { DEFAULT_CFG, CAT_LABEL, analyze } from '../engine';

const Head = ({ t, s, children }: { t: string; s?: string; children?: React.ReactNode }) => <div className="pg-h"><div><h1>{t}</h1>{s && <div className="mu">{s}</div>}</div><div className="sp" />{children}</div>;

export function AdminOverview() {
  const s = useStore(), { L, lang } = useL(), nav = useNavigate();
  const users = s.users.filter(u => u.role === 'user'), audited = s.cases.filter(c => c.audit);
  const stats = [[L('Users', 'பயனர்கள்'), users.length, '/admin/users'], [L('Cases', 'வழக்குகள்'), s.cases.length, '/admin/cases'], [L('Audits run', 'தணிக்கைகள்'), audited.length, '/admin/cases'], [L('Open reviews', 'திறந்த மதிப்பாய்வுகள்'), s.reviews.filter(r => r.status !== 'completed').length, '/admin/reviews'], [L('Revenue (demo)', 'வருவாய் (டெமோ)'), inr(s.payments.reduce((a, p) => a + p.amount, 0)), '/admin/users']] as const;
  return <div className="pg"><Head t={L('Admin overview', 'நிர்வாக மேலோட்டம்')} s={L('Click any number or row to see the data behind it.', 'எந்த எண் அல்லது வரியையும் கிளிக் செய்து தரவை காணலாம்.')}><button className="btn o sm" onClick={() => { if (confirm('Reset all demo data?')) { import('../store').then(m => m.resetDemo()); } }}>{L('Reset demo data', 'டெமோ தரவை மீட்டமை')}</button></Head>
    <div className="g c4" style={{ marginBottom: 20, gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))' }}>{stats.map(x => <div key={x[0]} className="panel stat" style={{ cursor: 'pointer' }} onClick={() => nav(x[2])}><span className="mu">{x[0]}</span><b>{typeof x[1] === 'number' ? <Num v={x[1]} /> : x[1]}</b></div>)}</div>
    <div className="g c2">
      <div className="panel"><div className="ph"><h3>{L('Recent users', 'சமீபத்திய பயனர்கள்')}</h3></div>{users.slice(-5).reverse().map(u => <div className="row" key={u.id} style={{ padding: '11px 20px', borderBottom: '1px solid var(--line)', cursor: 'pointer' }} onClick={() => nav(`/admin/users/${u.id}`)}><b className="sp">{u.name}<div className="mu sm" style={{ fontWeight: 400 }}>{u.email}</div></b><Tag tone="b">{u.plan}</Tag></div>)}</div>
      <div className="panel"><div className="ph"><h3>{L('Latest activity', 'சமீபத்திய செயல்கள்')}</h3><div className="sp" /><Link to="/admin/logs">{L('All logs', 'அனைத்தும்')}</Link></div>{s.logs.slice(0, 6).map(l => <div className="row" key={l.id} style={{ padding: '10px 20px', borderBottom: '1px solid var(--line)' }}><span className="sp"><b>{l.actor}</b> {l.action} {l.target && <span className="ev">{l.target}</span>}</span><span className="mu sm">{date(l.at, lang)}</span></div>)}</div>
    </div></div>;
}

export function AdminUsers() {
  const s = useStore(), { L, lang } = useL(), nav = useNavigate(), [q, setQ] = useState(''), [plan, setPlan] = useState('all');
  const list = s.users.filter(u => u.role === 'user' && (plan === 'all' || u.plan === plan) && (u.name + u.email + u.mobile).toLowerCase().includes(q.toLowerCase()));
  return <div className="pg"><Head t={L('Users', 'பயனர்கள்')} s={L('Click a user to see their cases, purchases and activity.', 'பயனரை கிளிக் செய்தால் வழக்குகள், வாங்குதல்கள், செயல்கள் தெரியும்.')}>
    <input className="in" style={{ width: 240 }} placeholder={L('Search name, email, mobile', 'பெயர், மின்னஞ்சல், மொபைல்')} value={q} onChange={e => setQ(e.target.value)} /><select className="in" style={{ width: 'auto' }} value={plan} onChange={e => setPlan(e.target.value)}><option value="all">{L('All plans', 'அனைத்து திட்டங்கள்')}</option>{['free', 'pro', 'professional', 'business'].map(p => <option key={p}>{p}</option>)}</select></Head>
    <div className="panel scroll"><table className="tbl"><thead><tr><th>{L('Name', 'பெயர்')}</th><th>{L('Mobile', 'மொபைல்')}</th><th>{L('Plan', 'திட்டம்')}</th><th>{L('Credits', 'கிரெடிட்')}</th><th>{L('Cases', 'வழக்குகள்')}</th><th>{L('Joined', 'சேர்ந்தது')}</th><th>{L('Status', 'நிலை')}</th></tr></thead><tbody>
      {list.map(u => <tr key={u.id} className="click" onClick={() => nav(`/admin/users/${u.id}`)}><td><b>{u.name}</b><div className="mu sm">{u.email}</div></td><td>{u.mobile}</td><td><Tag tone="b">{u.plan}</Tag></td><td>{u.credits}</td><td>{s.cases.filter(c => c.ownerId === u.id).length}</td><td>{date(u.joined, lang)}</td><td><Tag tone={u.status === 'active' ? '' : 'r'}>{u.status}</Tag></td></tr>)}</tbody></table>{!list.length && <Empty title={L('No users match', 'பொருந்தும் பயனர் இல்லை')} />}</div></div>;
}

export function AdminUser() {
  const { id } = useParams(), s = useStore(), { L, lang } = useL(), nav = useNavigate(), u = s.users.find(x => x.id === id);
  if (!u) return <div className="pg"><Empty title={L('User not found', 'பயனர் இல்லை')} /></div>;
  const cs = s.cases.filter(c => c.ownerId === u.id), pay = s.payments.filter(p => p.userId === u.id), logs = s.logs.filter(l => l.actor === u.name).slice(0, 8);
  return <div className="pg"><Head t={u.name} s={`${u.email} · ${u.mobile}`}><Link to="/admin/users">{L('All users', 'அனைத்து பயனர்கள்')}</Link></Head>
    <div className="g c3" style={{ marginBottom: 20 }}>
      <div className="panel stat"><span className="mu">{L('Plan', 'திட்டம்')}</span><b>{u.plan}</b></div><div className="panel stat"><span className="mu">{L('Credits', 'கிரெடிட்')}</span><b>{u.credits}</b></div>
      <div className="panel stat"><span className="mu">{L('Joined', 'சேர்ந்தது')}</span><b style={{ fontSize: 20 }}>{date(u.joined, lang)}</b></div></div>
    <div className="row wrap" style={{ marginBottom: 20 }}>
      <button className="btn o" onClick={() => api.adminUser(u.id, x => ({ ...x, credits: x.credits + 5 }), 'Admin added 5 credits')}>{L('Add 5 credits', '5 கிரெடிட் சேர்')}</button>
      <button className={`btn ${u.status === 'active' ? 'd' : ''}`} onClick={() => api.adminUser(u.id, x => ({ ...x, status: x.status === 'active' ? 'suspended' : 'active' }), u.status === 'active' ? 'Admin suspended account' : 'Admin reactivated account')}>{u.status === 'active' ? L('Suspend account', 'கணக்கை இடைநிறுத்து') : L('Reactivate account', 'மீண்டும் செயல்படுத்து')}</button></div>
    <div className="panel scroll" style={{ marginBottom: 20 }}><div className="ph"><h3>{L('Cases', 'வழக்குகள்')}</h3></div>{cs.length ? <table className="tbl"><tbody>{cs.map(c => <tr key={c.id} className="click" onClick={() => nav(`/cases/${c.id}`)}><td><b>{c.village || c.district}, {c.district}</b><div className="mu sm">{c.id} · S.No {c.survey}</div></td><td>{c.docs.length} {L('docs', 'ஆவணங்கள்')}</td><td>{c.audit ? <b>{c.audit.total}/100 · {c.audit.coverage}%</b> : <Tag tone="n">{L('Not audited', 'தணிக்கை இல்லை')}</Tag>}</td><td><a>{L('Open', 'திற')}</a></td></tr>)}</tbody></table> : <Empty title={L('No cases', 'வழக்குகள் இல்லை')} />}</div>
    <div className="g c2"><div className="panel"><div className="ph"><h3>{L('Purchases', 'வாங்குதல்கள்')}</h3></div>{pay.length ? pay.map(p => <div className="row" key={p.id} style={{ padding: '10px 20px', borderBottom: '1px solid var(--line)' }}><span className="sp">{p.pack}</span><span className="mu sm">{date(p.at, lang)}</span><b>{inr(p.amount)}</b></div>) : <Empty title={L('None', 'இல்லை')} />}</div>
      <div className="panel"><div className="ph"><h3>{L('Activity', 'செயல்கள்')}</h3></div>{logs.length ? logs.map(l => <div className="row" key={l.id} style={{ padding: '10px 20px', borderBottom: '1px solid var(--line)' }}><span className="sp">{l.action} {l.target && <span className="ev">{l.target}</span>}</span><span className="mu sm">{date(l.at, lang)}</span></div>) : <Empty title={L('None', 'இல்லை')} />}</div></div></div>;
}

export function AdminCases() {
  const s = useStore(), { L, lang } = useL(), nav = useNavigate();
  return <div className="pg"><Head t={L('All cases', 'அனைத்து வழக்குகள்')} s={L('Opens the same workspace the user sees, read-only.', 'பயனர் காணும் அதே பணியிடம், படிக்க மட்டும்.')} />
    <div className="panel scroll"><table className="tbl"><thead><tr><th>{L('Case', 'வழக்கு')}</th><th>{L('Owner', 'உரிமையாளர்')}</th><th>{L('Created', 'உருவாக்கம்')}</th><th>{L('Docs', 'ஆவணம்')}</th><th>{L('Score', 'மதிப்பெண்')}</th><th>{L('Coverage', 'வரம்பு')}</th><th>{L('Critical', 'முக்கியம்')}</th></tr></thead><tbody>
      {s.cases.map(c => <tr key={c.id} className="click" onClick={() => nav(`/cases/${c.id}`)}><td><b>{c.village || c.district}, {c.district}</b><div className="mu sm">{c.id} · S.No {c.survey}</div></td><td>{s.users.find(u => u.id === c.ownerId)?.name}</td><td>{date(c.created, lang)}</td><td>{c.docs.length}</td><td>{c.audit ? <b>{c.audit.total}</b> : '–'}</td><td>{c.audit ? c.audit.coverage + '%' : '–'}</td><td>{c.audit ? <Tag tone={c.audit.counts.critical ? 'r' : 'n'}>{c.audit.counts.critical}</Tag> : '–'}</td></tr>)}</tbody></table></div></div>;
}

export function AdminReviews() {
  const s = useStore(), { L, lang } = useL(), [rm, setRm] = useState<Record<string, string>>({});
  const pros = ['Adv. S. Meenakshi', 'Surveyor K. Balan', 'Planner R. Ilango', 'Valuer M. Farook'];
  const row = (r: Review) => { const u = s.users.find(x => x.id === r.userId); return <div className="find" key={r.id}>
    <div className="row wrap"><b className="sp">{r.kind} · <Link to={`/cases/${r.caseId}`}>{r.caseId}</Link> <span className="mu sm" style={{ fontWeight: 400 }}>{u?.name} · {date(r.at, lang)}</span></b><Tag tone={r.status === 'completed' ? '' : r.status === 'assigned' ? 'b' : 'a'}>{r.status}</Tag></div>
    {r.status === 'requested' && <div className="row" style={{ marginTop: 8 }}><select className="in" style={{ width: 220 }} id={'as' + r.id} defaultValue={pros[0]}>{pros.map(p => <option key={p}>{p}</option>)}</select><button className="btn sm" onClick={() => api.adminReview(r.id, { status: 'assigned', assignee: (document.getElementById('as' + r.id) as HTMLSelectElement).value }, 'Assigned review')}>{L('Assign', 'நியமி')}</button></div>}
    {r.status === 'assigned' && <div className="row" style={{ marginTop: 8 }}><span className="sm">{r.assignee}</span><input className="in" placeholder={L('Reviewer remark', 'மதிப்பாய்வாளர் குறிப்பு')} value={rm[r.id] ?? ''} onChange={e => setRm({ ...rm, [r.id]: e.target.value })} /><button className="btn sm" onClick={() => api.adminReview(r.id, { status: 'completed', remark: rm[r.id] || 'Reviewed' }, 'Completed review')}>{L('Mark done', 'முடிந்தது')}</button></div>}
    {r.remark && <div className="mu sm" style={{ marginTop: 6 }}>{r.assignee}: “{r.remark}”</div>}</div>; };
  return <div className="pg"><Head t={L('Review queue', 'மதிப்பாய்வு வரிசை')} s={L('Professional reviews requested by users.', 'பயனர்கள் கோரிய நிபுணர் மதிப்பாய்வுகள்.')} /><div className="panel">{s.reviews.length ? s.reviews.map(row) : <Empty title={L('Queue is empty', 'வரிசை காலி')} />}</div></div>;
}

type Src = { n: string; owner: string; access: string; api: string; perm: string; cost: string; fresh: string; st: 'up' | 'delayed' | 'down' | 'nc' };
export function AdminSources() {
  const { L } = useL(), [src, setSrc] = useState<Src[]>([
    { n: 'OpenStreetMap Overpass', owner: 'OSM community', access: 'Public API', api: 'Yes', perm: 'ODbL, fair use', cost: 'Free', fresh: 'Continuous', st: 'up' },
    { n: 'OSM / Esri map tiles', owner: 'OSM, Esri', access: 'Tile servers', api: 'Yes', perm: 'Attribution; fair use', cost: 'Free (low volume)', fresh: 'Continuous', st: 'up' },
    { n: 'TNREGINET (EC, registration)', owner: 'TN Registration Dept', access: 'To be requested', api: 'Unknown', perm: 'Not obtained', cost: 'Unknown', fresh: 'Unknown', st: 'nc' },
    { n: 'Patta / Chitta (Revenue)', owner: 'TN Revenue Dept', access: 'To be requested', api: 'Unknown', perm: 'Not obtained', cost: 'Unknown', fresh: 'Unknown', st: 'nc' },
    { n: 'CMDA / DTCP approvals', owner: 'Planning authorities', access: 'To be requested', api: 'Unknown', perm: 'Not obtained', cost: 'Unknown', fresh: 'Unknown', st: 'nc' },
    { n: 'eCourts case index', owner: 'eCourts', access: 'To be requested', api: 'Unknown', perm: 'Not obtained', cost: 'Unknown', fresh: 'Unknown', st: 'nc' },
  ]);
  const [busy, setBusy] = useState(false), [at, setAt] = useState('');
  const check = async () => { setBusy(true); const ok = await api.pingOverpass(); setSrc(x => x.map(s => s.n.startsWith('OpenStreetMap Overpass') ? { ...s, st: ok ? 'up' : 'down' } : s)); setAt(new Date().toLocaleTimeString()); setBusy(false); };
  const tone = (s: Src['st']) => (s === 'up' ? '' : s === 'delayed' ? 'a' : s === 'down' ? 'r' : 'n') as '' | 'a' | 'r' | 'n';
  const lab = (s: Src['st']) => ({ up: L('Available', 'கிடைக்கிறது'), delayed: L('Delayed', 'தாமதம்'), down: L('Unavailable', 'கிடைக்கவில்லை'), nc: L('Not connected', 'இணைக்கப்படவில்லை') }[s]);
  return <div className="pg"><Head t={L('Data sources', 'தரவு மூலங்கள்')} s={L('Sources that are not connected show as “Not verified” in user reports. We never fill them with fake data.', 'இணைக்கப்படாத மூலங்கள் பயனர் அறிக்கையில் “சரிபார்க்கப்படவில்லை” என வரும்; போலி தரவு நிரப்பப்படாது.')}><span className="mu sm">{at && L('Checked ', 'சரிபார்த்தது ') + at}</span><button className="btn" onClick={check} disabled={busy}>{busy ? L('Checking…', 'சரிபார்க்கிறது…') : L('Check Overpass now', 'Overpass-ஐ சரிபார்')}</button></Head>
    <div className="panel scroll"><table className="tbl"><thead><tr><th>{L('Source', 'மூலம்')}</th><th>{L('Owner', 'உரிமையாளர்')}</th><th>{L('Access', 'அணுகல்')}</th><th>API</th><th>{L('Permission', 'அனுமதி')}</th><th>{L('Cost', 'செலவு')}</th><th>{L('Updates', 'புதுப்பிப்பு')}</th><th>{L('Status', 'நிலை')}</th></tr></thead><tbody>
      {src.map(x => <tr key={x.n}><td><b>{x.n}</b></td><td>{x.owner}</td><td>{x.access}</td><td>{x.api}</td><td>{x.perm}</td><td>{x.cost}</td><td>{x.fresh}</td><td><Tag tone={tone(x.st)}>{lab(x.st)}</Tag></td></tr>)}</tbody></table></div></div>;
}

export function AdminLogs() {
  const s = useStore(), { L, lang } = useL();
  return <div className="pg"><Head t={L('Audit logs', 'செயல் பதிவுகள்')} s={L('Who did what, latest first.', 'யார் என்ன செய்தார், புதியது முதல்.')} /><div className="panel scroll"><table className="tbl"><thead><tr><th>{L('When', 'எப்போது')}</th><th>{L('Actor', 'செய்தவர்')}</th><th>{L('Action', 'செயல்')}</th><th>{L('Target', 'இலக்கு')}</th></tr></thead><tbody>
    {s.logs.map(l => <tr key={l.id}><td className="mu">{date(l.at, lang)} {new Date(l.at).toLocaleTimeString()}</td><td><b>{l.actor}</b></td><td>{l.action}</td><td>{l.target && <span className="ev">{l.target}</span>}</td></tr>)}</tbody></table></div></div>;
}


export function AdminAnalytics() {
  const s = useStore(), { L, B } = useL(), users = s.users.filter(u => u.role === 'user'), withCase = users.filter(u => s.cases.some(c => c.ownerId === u.id)), withDocs = users.filter(u => s.cases.some(c => c.ownerId === u.id && c.docs.length)), audited = users.filter(u => s.cases.some(c => c.ownerId === u.id && c.audit)), paid = users.filter(u => s.payments.some(p => p.userId === u.id));
  const funnel: [string, number][] = [[L('Signed up', 'பதிவு'), users.length], [L('Created a case', 'வழக்கு உருவாக்கம்'), withCase.length], [L('Uploaded documents', 'ஆவணம் பதிவேற்றம்'), withDocs.length], [L('Ran an audit', 'தணிக்கை'), audited.length], [L('Bought credits', 'கிரெடிட் வாங்கியவர்'), paid.length]];
  const top: Record<string, { n: number; t: { en: string; ta: string } }> = {};
  s.cases.forEach(c => c.audit?.findings.filter(f => f.sev !== 'info').forEach(f => { const k = f.title.en.replace(/[\d,.]+/g, '#').replace(/"[^"]*"/g, ''); (top[k] ??= { n: 0, t: f.title }).n++; }));
  const topList = Object.values(top).sort((a, b) => b.n - a.n).slice(0, 6), mx = Math.max(1, ...topList.map(x => x.n));
  const byPack: Record<string, number> = {}; s.payments.forEach(p => { byPack[p.pack] = (byPack[p.pack] ?? 0) + p.amount; });
  const avg = s.cases.filter(c => c.audit).reduce((a, c) => a + c.audit!.total, 0) / Math.max(1, s.cases.filter(c => c.audit).length);
  return <div className="pg"><Head t={L('Analytics', 'பகுப்பாய்வு')} s={L('Computed live from the data in this demo.', 'இந்த டெமோவின் தரவிலிருந்து நேரடியாக கணக்கிடப்பட்டது.')} />
    <div className="g c2">
      <div className="panel"><div className="ph"><h3>{L('Funnel', 'படிநிலை')}</h3></div>{funnel.map(([l, n], i) => <div className="row" key={l} style={{ padding: '12px 20px', borderBottom: '1px solid var(--line)' }}><span style={{ width: 170 }}>{l}</span><div className="bar"><i style={{ width: (users.length ? (n / users.length) * 100 : 0) + '%' }} /></div><b style={{ width: 70, textAlign: 'right' }}>{n}{i > 0 && funnel[i - 1][1] ? <span className="mu sm"> · {Math.round((n / funnel[i - 1][1]) * 100)}%</span> : ''}</b></div>)}</div>
      <div className="panel"><div className="ph"><h3>{L('Most common findings', 'அடிக்கடி வரும் முடிவுகள்')}</h3></div>{topList.length ? topList.map(x => <div className="row" key={x.t.en} style={{ padding: '12px 20px', borderBottom: '1px solid var(--line)' }}><span className="sp">{B(x.t)}</span><div className="bar" style={{ maxWidth: 90 }}><i style={{ width: (x.n / mx) * 100 + '%', background: 'var(--am)' }} /></div><b>{x.n}</b></div>) : <Empty title={L('No audits yet', 'தணிக்கை இல்லை')} />}</div>
      <div className="panel"><div className="ph"><h3>{L('Revenue by pack (demo)', 'பேக் வாரியாக வருவாய் (டெமோ)')}</h3></div>{Object.entries(byPack).map(([k, v]) => <div className="row" key={k} style={{ padding: '12px 20px', borderBottom: '1px solid var(--line)' }}><span className="sp">{k}</span><b>{inr(v)}</b></div>)}{!Object.keys(byPack).length && <Empty title={L('No purchases', 'வாங்குதல் இல்லை')} />}</div>
      <div className="panel"><div className="ph"><h3>{L('Quality', 'தரம்')}</h3></div><div className="row" style={{ padding: '12px 20px', borderBottom: '1px solid var(--line)' }}><span className="sp">{L('Average score', 'சராசரி மதிப்பெண்')}</span><b>{Math.round(avg)}</b></div><div className="row" style={{ padding: '12px 20px' }}><span className="sp">{L('Audits with a critical finding', 'மிக முக்கிய முடிவுடன் தணிக்கைகள்')}</span><b>{s.cases.filter(c => c.audit?.counts.critical).length}</b></div></div>
    </div></div>;
}

export function AdminRules() {
  const s = useStore(), { L, B } = useL(), [cfg, setCfg] = useState<Cfg>(s.config ?? DEFAULT_CFG), [cid, setCid] = useState(s.cases.find(c => c.audit)?.id ?? ''), [ok, setOk] = useState(false);
  const sum = (Object.values(cfg.max) as number[]).reduce((a, b) => a + b, 0), c = s.cases.find(x => x.id === cid);
  const live = c ? analyze(c, cfg) : undefined, cur = c ? analyze(c, s.config ?? DEFAULT_CFG) : undefined, sevs: Sev[] = ['critical', 'high', 'medium', 'low'];
  return <div className="pg"><Head t={L('Score rules', 'மதிப்பெண் விதிகள்')} s={L('Change the weights and see the effect on a real case before saving. Saved rules apply to the next audit run.', 'எடைகளை மாற்றி சேமிக்கும் முன் உண்மை வழக்கில் விளைவை பாருங்கள். சேமித்த விதிகள் அடுத்த தணிக்கைக்கு.')}><button className="btn o" onClick={() => setCfg(DEFAULT_CFG)}>{L('Reset to default', 'இயல்புக்கு')}</button><button className="btn" onClick={() => { api.saveConfig(cfg); setOk(true); }}>{L('Save rules', 'விதிகளை சேமி')}</button></Head>
    {ok && <div className="notice" role="status">{L('Saved. It applies to audits run from now on.', 'சேமிக்கப்பட்டது. இனி இயக்கும் தணிக்கைகளுக்கு பொருந்தும்.')}</div>}
    <div className="g c2">
      <div className="col"><div className="panel"><div className="ph"><h3>{L('Category weights', 'வகை எடைகள்')}</h3><div className="sp" /><Tag tone={sum === 100 ? '' : 'a'}>{L('Total', 'மொத்தம்')} {sum}</Tag></div>{(Object.keys(cfg.max) as Cat[]).map(k => <div className="row" key={k} style={{ padding: '9px 20px', borderBottom: '1px solid var(--line)' }}><span className="sp">{B(CAT_LABEL[k])}</span><input className="in" type="number" min={0} max={50} style={{ width: 80 }} value={cfg.max[k]} onChange={e => setCfg({ ...cfg, max: { ...cfg.max, [k]: +e.target.value } })} /></div>)}</div>
        <div className="panel"><div className="ph"><h3>{L('Penalty per finding (% of a category)', 'ஒரு முடிவுக்கு குறைப்பு (வகையின் %)')}</h3></div>{sevs.map(k => <div className="row" key={k} style={{ padding: '9px 20px', borderBottom: '1px solid var(--line)' }}><span className="sp" style={{ textTransform: 'capitalize' }}>{k}</span><input className="in" type="number" min={0} max={100} style={{ width: 80 }} value={Math.round(cfg.pen[k] * 100)} onChange={e => setCfg({ ...cfg, pen: { ...cfg.pen, [k]: +e.target.value / 100 } })} /></div>)}<div className="row" style={{ padding: '9px 20px' }}><span className="sp">{L('Score cap when a critical finding exists', 'மிக முக்கிய முடிவு இருந்தால் உச்ச மதிப்பெண்')}</span><input className="in" type="number" min={0} max={100} style={{ width: 80 }} value={cfg.cap} onChange={e => setCfg({ ...cfg, cap: +e.target.value })} /></div></div></div>
      <div className="panel pad" style={{ alignSelf: 'start' }}><h3 style={{ marginBottom: 10 }}>{L('Preview on a real case', 'உண்மை வழக்கில் முன்னோட்டம்')}</h3>
        <select className="in" value={cid} onChange={e => setCid(e.target.value)}>{s.cases.filter(x => x.docs.length).map(x => <option key={x.id} value={x.id}>{x.id} · {x.village || x.district}</option>)}</select>
        {live && cur && <div className="g c2" style={{ marginTop: 16 }}><div className="stat panel"><span className="mu">{L('Current rules', 'தற்போதைய விதிகள்')}</span><b>{cur.total}</b></div><div className="stat panel" style={{ borderColor: 'var(--g)' }}><span className="mu">{L('Your draft', 'உங்கள் வரைவு')}</span><b>{live.total}</b></div></div>}
        <p className="mu sm">{L('Evidence coverage changes with the weights too: ', 'எடைகளுடன் ஆதார வரம்பும் மாறும்: ')}{live?.coverage}%</p></div>
    </div></div>;
}
