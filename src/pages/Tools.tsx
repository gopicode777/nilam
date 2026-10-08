import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store';
import { useL } from '../i18n';
import { Empty, Ring, Tag, date } from '../ui';
import * as api from '../api';
import type { Review } from '../types';

export function Compare() {
  const s = useStore(), { L, B } = useL(), mine = s.cases.filter(c => c.ownerId === s.session && c.audit), [sel, setSel] = useState<string[]>(mine.slice(0, 2).map(c => c.id));
  const cs = mine.filter(c => sel.includes(c.id)), best = Math.max(...cs.map(c => c.audit!.total), 0);
  const rows: [string, (c: (typeof cs)[0]) => React.ReactNode][] = [
    [L('Score', 'மதிப்பெண்'), c => <span className="row"><b style={{ fontSize: 20 }}>{c.audit!.total}</b>{c.audit!.total === best && cs.length > 1 && <Tag>{L('Highest', 'அதிகம்')}</Tag>}</span>],
    [L('Evidence coverage', 'ஆதார வரம்பு'), c => c.audit!.coverage + '%'],
    [L('Verdict', 'முடிவு'), c => B(c.audit!.verdict)],
    [L('Critical / high', 'மிக முக்கியம் / உயர்'), c => <Tag tone={c.audit!.counts.critical + c.audit!.counts.high ? 'r' : 'n'}>{c.audit!.counts.critical} / {c.audit!.counts.high}</Tag>],
    [L('To verify', 'சரிபார்க்க'), c => c.audit!.counts.verify],
    [L('Extent (sq.ft)', 'பரப்பு (ச.அடி)'), c => c.extent.toLocaleString('en-IN')],
    [L('Documents', 'ஆவணங்கள்'), c => c.docs.length],
    [L('Not checked', 'சரிபார்க்கவில்லை'), c => c.audit!.counts.pending],
    [L('Main concern', 'முக்கிய கவலை'), c => c.audit!.findings.find(f => f.sev !== 'info') ? B(c.audit!.findings.find(f => f.sev !== 'info')!.title) : '–'],
  ];
  return <div className="pg"><div className="pg-h"><div><h1>{L('Compare plots', 'நிலங்களை ஒப்பிடு')}</h1><div className="mu">{L('Pick up to three audited cases. Compare coverage as well as score.', 'தணிக்கை முடிந்த 3 வழக்குகள் வரை. மதிப்பெண்ணுடன் ஆதார வரம்பையும் ஒப்பிடுங்கள்.')}</div></div></div>
    {!mine.length ? <div className="panel"><Empty title={L('Nothing to compare yet', 'ஒப்பிட எதுவும் இல்லை')} hint={L('Run an audit on at least two cases.', 'குறைந்தது இரு வழக்குகளில் தணிக்கை இயக்கவும்.')}><Link className="btn" to="/new">{L('Start new audit', 'புதிய தணிக்கை')}</Link></Empty></div> : <>
      <div className="row wrap" style={{ marginBottom: 16 }}>{mine.map(c => <button key={c.id} className={`chip ${sel.includes(c.id) ? 'on' : ''}`} onClick={() => setSel(sel.includes(c.id) ? sel.filter(x => x !== c.id) : sel.length < 3 ? [...sel, c.id] : sel)}>{c.village || c.district} · {c.survey}</button>)}</div>
      {cs.length ? <div className="panel scroll"><table className="tbl"><thead><tr><th />{cs.map(c => <th key={c.id}><Link to={`/cases/${c.id}`}>{c.village || c.district}, S.No {c.survey}</Link></th>)}</tr></thead><tbody>
        <tr><td className="mu" />{cs.map(c => <td key={c.id}><Ring v={c.audit!.total} tone={c.audit!.tone} size={84} /></td>)}</tr>
        {rows.map(([l, f]) => <tr key={l}><td className="mu" style={{ width: 180 }}>{l}</td>{cs.map(c => <td key={c.id}>{f(c)}</td>)}</tr>)}</tbody></table></div> : <Empty title={L('Select cases above', 'மேலே வழக்குகளை தேர்வு செய்க')} />}</>}</div>;
}

const PROS: { n: string; kind: Review['kind']; city: string; lang: string; yrs: number; note: string }[] = [
  { n: 'Adv. S. Meenakshi', kind: 'advocate', city: 'Chennai', lang: 'English, தமிழ்', yrs: 14, note: 'Title search, EC review, parent-deed chains' },
  { n: 'Adv. K. Rajasekar', kind: 'advocate', city: 'Vellore', lang: 'English, தமிழ்', yrs: 9, note: 'Agricultural land, patta and succession issues' },
  { n: 'Surveyor K. Balan', kind: 'surveyor', city: 'Tiruvallur', lang: 'தமிழ், English', yrs: 17, note: 'FMB, sub-division, boundary and extent checks' },
  { n: 'Planner R. Ilango', kind: 'planner', city: 'Coimbatore', lang: 'English, தமிழ்', yrs: 11, note: 'DTCP / CMDA layout approvals and zoning' },
  { n: 'Valuer M. Farook', kind: 'valuer', city: 'Madurai', lang: 'English, தமிழ்', yrs: 12, note: 'Market value against guideline value' },
];
export function Professionals() {
  const s = useStore(), { L } = useL(), mine = s.cases.filter(c => c.ownerId === s.session), [kind, setKind] = useState<'all' | Review['kind']>('all'), [pick, setPick] = useState<string | null>(null), [cid, setCid] = useState(mine[0]?.id ?? ''), [done, setDone] = useState('');
  const kl = (k: Review['kind']) => ({ advocate: L('Advocate', 'வழக்கறிஞர்'), surveyor: L('Surveyor', 'சர்வேயர்'), planner: L('Planner', 'திட்ட நிபுணர்'), valuer: L('Valuer', 'மதிப்பீட்டாளர்') }[k]);
  const req = (p: (typeof PROS)[0]) => { if (!cid) return; api.requestReview(cid, p.kind, p.n); setPick(null); setDone(L(`Review requested from ${p.n}. You will see the remark in your report.`, `${p.n}-இடம் மதிப்பாய்வு கோரப்பட்டது. குறிப்பு உங்கள் அறிக்கையில் தெரியும்.`)); };
  return <div className="pg"><div className="pg-h"><div><h1>{L('Professionals', 'நிபுணர்கள்')}</h1><div className="mu">{L('AI cannot certify title or boundaries. These people can. Fees are quoted per case before you confirm.', 'AI உரிமை, எல்லையை சான்றளிக்க முடியாது; இவர்களால் முடியும். கட்டணம் உறுதிக்கு முன் மேற்கோளாக காட்டப்படும்.')}</div></div></div>
    <div className="notice">{L('Demo listing. These profiles are placeholders.', 'டெமோ பட்டியல். இந்த சுயவிவரங்கள் மாதிரி.')}</div>{done && <div className="notice" role="status" style={{ background: 'var(--gl)', color: 'var(--g2)' }}>{done}</div>}
    <div className="row wrap" style={{ marginBottom: 16 }}>{(['all', 'advocate', 'surveyor', 'planner', 'valuer'] as const).map(k => <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>{k === 'all' ? L('All', 'அனைத்தும்') : kl(k)}</button>)}</div>
    <div className="panel">{PROS.filter(p => kind === 'all' || p.kind === kind).map(p => <div key={p.n} className="row" style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', alignItems: 'flex-start' }}>
      <div className="sp"><b>{p.n}</b> <Tag tone="b">{kl(p.kind)}</Tag><div className="mu">{p.note}</div><div className="mu sm">{p.city} · {p.lang} · {p.yrs} {L('years', 'ஆண்டுகள்')}</div></div>
      {pick === p.n ? <div className="row"><select className="in" style={{ width: 200 }} value={cid} onChange={e => setCid(e.target.value)}>{mine.map(c => <option key={c.id} value={c.id}>{c.village || c.district} · {c.survey}</option>)}</select><button className="btn sm" disabled={!cid} onClick={() => req(p)}>{L('Confirm', 'உறுதி')}</button></div> : <button className="btn o" onClick={() => setPick(p.n)} disabled={!mine.length}>{L('Request review', 'மதிப்பாய்வு கோரு')}</button>}</div>)}</div></div>;
}

export function Settings() {
  const s = useStore(), { L, lang } = useL(), u = s.users.find(x => x.id === s.session)!, [name, setName] = useState(u.name), [mobile, setMobile] = useState(u.mobile), [pr, setPr] = useState(u.prefs ?? { email: true, whatsapp: false, alerts: true }), [ok, setOk] = useState(false), [del, setDel] = useState('');
  const tog = (k: keyof typeof pr, l: string, d: string) => <label className="row" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)', cursor: 'pointer' }}><span className="sp"><b>{l}</b><div className="mu sm">{d}</div></span><input type="checkbox" checked={pr[k]} onChange={e => setPr({ ...pr, [k]: e.target.checked })} /></label>;
  return <div className="pg" style={{ maxWidth: 760 }}><div className="pg-h"><h1>{L('Settings', 'அமைப்புகள்')}</h1></div>
    <div className="panel pad" style={{ marginBottom: 16 }}><h3 style={{ marginBottom: 14 }}>{L('Profile', 'சுயவிவரம்')}</h3>
      <div className="fld"><label className="f">{L('Name', 'பெயர்')}</label><input className="in" value={name} onChange={e => setName(e.target.value)} /></div>
      <div className="fld"><label className="f">{L('Mobile', 'மொபைல்')}</label><input className="in" value={mobile} onChange={e => setMobile(e.target.value)} maxLength={10} /></div>
      <div className="fld"><label className="f">{L('Email', 'மின்னஞ்சல்')}</label><input className="in" value={u.email} disabled /></div>
      <div className="fld"><label className="f">{L('Language', 'மொழி')}</label><select className="in" value={lang} onChange={e => api.setLang(e.target.value as 'en' | 'ta')}><option value="en">English</option><option value="ta">தமிழ்</option></select></div>
      {tog('alerts', L('Case alerts', 'வழக்கு எச்சரிக்கைகள்'), L('When a review is completed or a record changes.', 'மதிப்பாய்வு முடிந்தால் அல்லது பதிவு மாறினால்.'))}{tog('email', L('Email updates', 'மின்னஞ்சல் அறிவிப்புகள்'), L('Receipts and report-ready messages.', 'ரசீது, அறிக்கை தயார் செய்தி.'))}{tog('whatsapp', L('WhatsApp updates', 'WhatsApp அறிவிப்புகள்'), L('Short alerts on your mobile number.', 'உங்கள் மொபைலில் சுருக்க எச்சரிக்கை.'))}
      <div className="row" style={{ marginTop: 16 }}><button className="btn" onClick={() => { api.saveProfile({ name: name.trim() || u.name, mobile, prefs: pr }); setOk(true); }}>{L('Save changes', 'மாற்றங்களை சேமி')}</button>{ok && <span className="mu" role="status">{L('Saved', 'சேமிக்கப்பட்டது')}</span>}</div></div>
    <div className="panel pad" style={{ borderColor: 'var(--rd)' }}><h3 style={{ marginBottom: 6, color: 'var(--rd)' }}>{L('Delete my data', 'என் தரவை நீக்கு')}</h3><p className="mu" style={{ marginTop: 0 }}>{L('This removes your account, every case, document and review request. It cannot be undone. Type DELETE to confirm.', 'கணக்கு, அனைத்து வழக்குகள், ஆவணங்கள், மதிப்பாய்வு கோரிக்கைகளை நீக்கும். திரும்பப்பெற முடியாது. உறுதிக்கு DELETE என தட்டச்சு செய்க.')}</p>
      <div className="row"><input className="in" style={{ width: 180 }} value={del} onChange={e => setDel(e.target.value)} placeholder="DELETE" /><button className="btn d" disabled={del !== 'DELETE'} onClick={api.deleteMyData}>{L('Delete everything', 'அனைத்தையும் நீக்கு')}</button></div></div>
    <p className="mu sm" style={{ marginTop: 14 }}>{L('Joined', 'சேர்ந்தது')} {date(u.joined, lang)} · <Link to="/legal/privacy">{L('Privacy', 'தனியுரிமை')}</Link> · <Link to="/legal/terms">{L('Terms', 'விதிகள்')}</Link></p></div>;
}
