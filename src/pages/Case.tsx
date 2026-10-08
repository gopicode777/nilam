import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Link, NavLink, Route, Routes, useLocation, useParams } from 'react-router-dom';
import DownloadPanel from '../components/Download';
import ReportDoc from '../components/ReportDoc';
import { staticMap, downloadReport } from '../lib/pdf';
import { ALL_OPT } from '../components/ReportDoc';
import { useStore } from '../store';
import { useL, pick } from '../i18n';
import { CAT_LABEL, DOC_LABEL, FIELD_LABEL, NEARBY_CATS, buildChain, evalClaim, sellerQuestions } from '../engine';
import type { ClaimResult } from '../engine';
import MapView from '../components/MapView';
import { Empty, Num, Prov, Ring, Tag, date, sevTone, useSev } from '../ui';
import { nextStep } from './Dashboard';
import * as api from '../api';
import type { Case, Claim, Review } from '../types';

type LFn = (en: string, ta: string) => string;
const claimTone = (r: ClaimResult['res']) => (r === 'supported' ? '' : r === 'partial' ? 'a' : r === 'not' ? 'r' : 'n') as '' | 'a' | 'r' | 'n';
const claimLabel = (r: ClaimResult['res'], L: LFn) => ({ supported: L('Consistent', 'ஒத்துப்போகிறது'), partial: L('Partly supported', 'பகுதி உறுதி'), not: L('Not supported', 'உறுதியில்லை'), unverified: L('Not verified', 'சரிபார்க்கப்படவில்லை') }[r]);

export default function CaseWorkspace() {
  const { id } = useParams(), s = useStore(), { L } = useL(), c = s.cases.find(x => x.id === id), seg = useLocation().pathname.split('/')[3] ?? '';
  if (!c) return <div className="pg"><Empty title={L('Case not found', 'வழக்கு கிடைக்கவில்லை')}><Link to="/">{L('Back to dashboard', 'முகப்புக்கு')}</Link></Empty></div>;
  const ro = c.ownerId !== s.session, owner = s.users.find(u => u.id === c.ownerId);
  const verified = c.docs.length > 0 && c.docs.every(d => d.verified);
  const steps = [['', L('Overview', 'மேலோட்டம்'), true], ['documents', L('Documents', 'ஆவணங்கள்'), verified], ['location', L('Location', 'இடம்'), !!c.nearby], ['claims', L('Claims', 'கூற்றுகள்'), c.claims.length > 0], ['audit', L('Audit', 'தணிக்கை'), !!c.audit]] as const;
  return <div className="pg">
    {ro && <div className="notice">{L('Read-only view. Case owner: ', 'படிக்க மட்டும். உரிமையாளர்: ')}<b>{owner?.name}</b> ({owner?.email})</div>}
    <div className="pg-h"><div><h1>{c.village || c.district}, {c.district} <span className="mu" style={{ fontWeight: 400 }}>S.No {c.survey}</span></h1><div className="mu">{c.id} · {c.ptype} · {c.extent.toLocaleString('en-IN')} {L('sq.ft', 'ச.அடி')}</div></div></div>
    <div className="rail noprint">{steps.map(([to, label, done], i) => <NavLink key={to} to={`/cases/${c.id}/${to}`} end className={({ isActive }) => 'rs' + (done ? ' done' : '') + (isActive ? ' on' : '')}><span className={`dot ${done ? 'ok' : ''}`} />{i > 0 ? `${i}. ` : ''}{label}</NavLink>)}</div>
    <div className="tabs noprint">{([['chain', L('Ownership chain', 'உரிமை சங்கிலி')], ['questions', L('Seller questions', 'விற்பவருக்கான கேள்விகள்')], ['assistant', L('Assistant', 'உதவியாளர்')], ['report', L('Report', 'அறிக்கை')], ['share', L('Share', 'பகிர்')]] as const).map(([to, label]) => <NavLink key={to} to={`/cases/${c.id}/${to}`} className={({ isActive }) => 'tab' + (isActive ? ' on' : '')}>{label}</NavLink>)}</div>
    <div key={seg} className="tab-in"><Routes>
      <Route path="chain" element={<Chain c={c} />} /><Route path="questions" element={<Questions c={c} />} /><Route path="share" element={<Share c={c} ro={ro} />} />
      <Route index element={<Overview c={c} ro={ro} />} /><Route path="documents" element={<Documents c={c} ro={ro} />} /><Route path="location" element={<Location c={c} ro={ro} />} />
      <Route path="claims" element={<Claims c={c} ro={ro} />} /><Route path="audit" element={<AuditTab c={c} ro={ro} />} /><Route path="assistant" element={<Assistant c={c} />} /><Route path="report" element={<Report c={c} />} />
    </Routes></div>
    <StepNav c={c} />
  </div>;
}

/** Back / next through the five audit steps, so nobody has to hunt for the next tab. */
function StepNav({ c }: { c: Case }) {
  const { L } = useL(), loc = useLocation(), cur = loc.pathname.split('/')[3] ?? '';
  const seq: [string, string][] = [['', L('Overview', 'மேலோட்டம்')], ['documents', L('Documents', 'ஆவணங்கள்')], ['location', L('Location', 'இடம்')], ['claims', L('Claims (optional)', 'கூற்றுகள் (விருப்பம்)')], ['audit', L('Audit', 'தணிக்கை')]];
  const i = seq.findIndex(x => x[0] === cur); if (i < 0) return null;
  const prev = seq[i - 1], next = seq[i + 1];
  return <div className="row noprint" style={{ marginTop: 22, paddingTop: 16, borderTop: '1px solid var(--line)' }}>{prev && <Link className="btn o" to={`/cases/${c.id}/${prev[0]}`}>← {prev[1]}</Link>}<div className="sp" />{next ? <Link className="btn" to={`/cases/${c.id}/${next[0]}`}>{L('Continue to', 'தொடர்க:')} {next[1]} →</Link> : <Link className="btn" to={`/cases/${c.id}/report`}>{L('Open report', 'அறிக்கையை திற')} →</Link>}</div>;
}

function Overview({ c, ro }: { c: Case; ro: boolean }) {
  const { L, lang } = useL(), n = nextStep(c, L);
  const checks: [string, boolean, string][] = [[L('Property details added', 'நில விவரம் சேர்க்கப்பட்டது'), true, ''], [L('Documents uploaded and confirmed', 'ஆவணங்கள் பதிவேற்றி உறுதி செய்யப்பட்டன'), c.docs.length > 0 && c.docs.every(d => d.verified), 'documents'], [L('Location analysed', 'இடம் பகுப்பாய்வு'), !!c.nearby, 'location'], [L('Broker claims checked (optional)', 'தரகர் கூற்றுகள் (விருப்பம்)'), c.claims.length > 0, 'claims'], [L('Audit run', 'தணிக்கை இயக்கப்பட்டது'), !!c.audit, 'audit']];
  return <div className="g c21">
    <div className="col">
      <div className="panel pad"><h3 style={{ marginBottom: 10 }}>{L('How this audit works', 'இந்த தணிக்கை எப்படி செயல்படுகிறது')}</h3>
        {checks.map(([t, d, to]) => <div className="row" key={t} style={{ padding: '9px 0', borderBottom: '1px solid var(--line)' }}><span className={`dot ${d ? 'ok' : ''}`} /><span className="sp">{t}</span>{to && <Link to={`/cases/${c.id}/${to}`}>{d ? L('Open', 'திற') : L('Do this', 'செய்க')}</Link>}</div>)}
        {!ro && <div style={{ marginTop: 16 }}><Link className="btn" to={`/cases/${c.id}/${n.to}`}>{n.text}</Link></div>}</div>
      <div className="panel pad"><h3 style={{ marginBottom: 10 }}>{L('Property', 'நிலம்')}</h3>
        {[[L('District / taluk / village', 'மாவட்டம் / வட்டம் / கிராமம்'), `${c.district} / ${c.taluk || '-'} / ${c.village || '-'}`], [L('Survey number', 'சர்வே எண்'), c.survey], [L('Seller', 'விற்பவர்'), c.seller], [L('Purpose', 'நோக்கம்'), c.purpose], [L('Created', 'உருவாக்கம்'), date(c.created, lang)]].map(r => <div className="row" key={r[0]} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}><span className="mu" style={{ width: 200 }}>{r[0]}</span><b>{r[1]}</b></div>)}</div>
    </div>
    <div className="panel pad"><MapView lat={c.lat} lng={c.lng} sqft={c.extent} height={360} /></div>
  </div>;
}

function Documents({ c, ro }: { c: Case; ro: boolean }) {
  const { L, B } = useL(), [err, setErr] = useState(''), [view, setView] = useState<string | null>(null), [hot, setHot] = useState('');
  const have = new Set(c.docs.map(d => d.type));
  const upload = (files: FileList | null) => {
    if (!files) return; const ok = [...files].filter(f => f.size <= 15 * 1048576);
    setErr(ok.length < files.length ? L('Files over 15 MB were skipped.', '15 MB-க்கு மேல் உள்ள கோப்புகள் தவிர்க்கப்பட்டன.') : ''); if (ok.length) api.addFiles(c.id, ok.map(f => f.name));
  };
  return <div className="g c21">
    <div className="col">
      {!ro && <div className="panel pad"><label style={{ display: 'block', border: '1.5px dashed var(--line)', borderRadius: 8, padding: 26, textAlign: 'center', cursor: 'pointer' }}>
        <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={e => upload(e.target.files)} />
        <b>{L('Choose files to upload', 'பதிவேற்ற கோப்புகளை தேர்வு செய்க')}</b><div className="mu sm">{L('PDF, JPG or PNG up to 15 MB. Name the file with its type (deed, patta, ec) so it is classified correctly.', 'PDF, JPG, PNG; 15 MB வரை. கோப்பு பெயரில் வகை (deed, patta, ec) இருக்கட்டும்.')}</div></label>
        <div className="err">{err}</div>{!c.docs.length && <button className="btn o sm" onClick={() => api.addSampleDocs(c.id)}>{L('Load sample deed, patta and EC', 'மாதிரி பத்திரம், பட்டா, EC ஏற்று')}</button>}
        <div className="mu sm" style={{ marginTop: 8 }}>{L('Demo OCR: values are generated, not read from your file. Edit any value and the audit reacts.', 'டெமோ OCR: மதிப்புகள் உருவாக்கப்பட்டவை; உங்கள் கோப்பிலிருந்து படிக்கப்பட்டவை அல்ல. மாற்றினால் தணிக்கை மாறும்.')}</div></div>}
      {!c.docs.length && ro && <div className="panel"><Empty title={L('No documents', 'ஆவணங்கள் இல்லை')} /></div>}
      {c.docs.map(d => <div className="panel" key={d.id}>
        <div className="ph"><b>{B(DOC_LABEL[d.type])}</b><span className="mu sm">{d.name}</span><div className="sp" /><Prov kind={d.verified ? 'manual' : 'user'} />
          <button className="btn o sm" onClick={() => { setView(view === d.id ? null : d.id); setHot(''); }}>{view === d.id ? L('Close viewer', 'மூடு') : L('View', 'பார்')}</button>{!ro && <><button className="btn sm" onClick={() => api.confirmDoc(c.id, d.id, !d.verified)}>{d.verified ? L('Unconfirm', 'உறுதியை நீக்கு') : L('Confirm values', 'உறுதி செய்')}</button><button className="btn o sm" onClick={() => api.removeDoc(c.id, d.id)}>{L('Remove', 'நீக்கு')}</button></>}</div>
        {view === d.id && <DocViewer d={d} hot={hot} setHot={setHot} />}
        <table className="tbl"><tbody>{Object.entries(d.fields).map(([k, f]) => <tr key={k} onMouseEnter={() => setHot(k)}><td style={{ width: 190 }} className="mu">{B(FIELD_LABEL[k] ?? { en: k, ta: k })}</td>
          <td><input className="in" value={f.v} disabled={ro} onChange={e => api.updateField(c.id, d.id, k, e.target.value)} aria-label={k} /></td>
          <td style={{ width: 150 }}><Tag tone={f.conf >= 92 ? '' : f.conf >= 88 ? 'b' : 'a'}>{f.conf}% {L('sure', 'உறுதி')}</Tag></td><td className="mu sm" style={{ width: 70 }}>{L('Page', 'பக்கம்')} {f.page}</td></tr>)}</tbody></table></div>)}
    </div>
    <div className="panel pad" style={{ alignSelf: 'start' }}><h3 style={{ marginBottom: 10 }}>{L('Document checklist', 'ஆவண பட்டியல்')}</h3>
      {(['sale_deed', 'patta', 'ec', 'parent', 'chitta', 'fmb', 'approval', 'tax'] as const).map((t, i) => <div className="row" key={t} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}><span className={`dot ${have.has(t) ? 'ok' : ''}`} /><span className="sp">{B(DOC_LABEL[t])}</span><Tag tone={have.has(t) ? '' : i < 3 ? 'a' : 'n'}>{have.has(t) ? L('Added', 'சேர்ந்தது') : i < 3 ? L('Needed', 'தேவை') : L('Optional', 'விருப்பம்')}</Tag></div>)}
      {!ro && c.docs.length > 0 && <Link className="btn" style={{ marginTop: 14, width: '100%' }} to={`/cases/${c.id}/location`}>{L('Continue to location', 'இடத்திற்கு தொடர்க')}</Link>}</div>
  </div>;
}

function Location({ c, ro }: { c: Case; ro: boolean }) {
  const { L, B } = useL(), [r, setR] = useState(c.radius), [sel, setSel] = useState<string[]>(['hospital', 'school', 'bank', 'bus_station']), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const run = async () => { setBusy(true); setErr(''); try { await api.analyseLocation(c.id, sel, r); } catch { setErr(L('Map data source is not responding. Nothing was saved; try again in a minute.', 'வரைபட தரவு மூலம் பதிலளிக்கவில்லை. எதுவும் சேமிக்கப்படவில்லை; ஒரு நிமிடத்தில் மீண்டும் முயற்சிக்கவும்.')); } setBusy(false); };
  return <div className="g c21">
    <div className="panel pad"><MapView lat={c.lat} lng={c.lng} sqft={c.extent} radius={r} nearby={c.nearby} height={470} /></div>
    <div className="col">
      <div className="panel pad">
        <div className="fld"><label className="f">{L('Radius', 'சுற்றளவு')}</label><select className="in" value={r} onChange={e => setR(+e.target.value)} disabled={ro}>{[500, 1000, 2000, 5000].map(x => <option key={x} value={x}>{x >= 1000 ? x / 1000 + ' km' : x + ' m'}</option>)}</select></div>
        <div className="row wrap" style={{ gap: 8, marginBottom: 14 }}>{Object.entries(NEARBY_CATS).map(([k, v]) => <button key={k} className={`chip ${sel.includes(k) ? 'on' : ''}`} disabled={ro} onClick={() => setSel(sel.includes(k) ? sel.filter(x => x !== k) : [...sel, k])}>{B(v.label)}</button>)}</div>
        {!ro && <button className="btn" disabled={busy || !sel.length} onClick={run}>{busy ? L('Fetching…', 'பெறுகிறது…') : L('Analyse location', 'இடத்தை பகுப்பாய்வு செய்')}</button>}
        <div className="err" role="alert">{err}</div>
        <div className="mu sm">{L('Distances are straight-line from your pin. Nearby places are facts about the area, not a quality score for the plot.', 'தூரங்கள் உங்கள் பின்னிலிருந்து நேர்கோட்டில். அருகிலுள்ள இடங்கள் பகுதி பற்றிய தகவல்; நிலத்தின் தர மதிப்பெண் அல்ல.')}</div></div>
      {c.nearby ? Object.entries(c.nearby).map(([k, list]) => <div className="panel" key={k}><div className="ph"><b>{B(NEARBY_CATS[k].label)}</b><div className="sp" /><Prov kind="live" at={c.nearbyAt} /></div>
        {list.length ? list.slice(0, 4).map(i => <div className="row" key={i.lat + '' + i.lng} style={{ padding: '9px 20px', borderBottom: '1px solid var(--line)' }}><span className="sp">{i.name}</span><b>{i.km.toFixed(1)} km</b></div>) : <div className="mu" style={{ padding: 16 }}>{L('None found in this radius.', 'இந்த சுற்றளவில் இல்லை.')}</div>}</div>)
        : <div className="panel"><Empty title={L('No location data yet', 'இட தரவு இல்லை')} hint={L('Choose categories and analyse. Source: OpenStreetMap.', 'வகைகளை தேர்ந்து பகுப்பாய்வு செய்க. மூலம்: OpenStreetMap.')} /></div>}
    </div>
  </div>;
}

const TEMPLATES: { text: string; kind: Claim['kind']; target?: string; km?: number; value?: number }[] = [
  { text: 'Hospitals within 1 km', kind: 'distance', target: 'hospital', km: 1 }, { text: 'Schools within 1 km', kind: 'distance', target: 'school', km: 1 }, { text: 'Bus stands within 1 km', kind: 'distance', target: 'bus_station', km: 1 },
  { text: 'Approved layout', kind: 'approval' }, { text: 'Clear title, no loan', kind: 'title' }, { text: 'Road width 30 ft', kind: 'road', value: 30 }, { text: 'Good groundwater', kind: 'groundwater' },
];
function Claims({ c, ro }: { c: Case; ro: boolean }) {
  const { L, B } = useL(), [f, setF] = useState({ kind: 'distance' as Claim['kind'], target: 'hospital', km: 1, value: 0, guide: 0, text: '', by: 'broker' as NonNullable<Claim['by']> });
  const res = c.claims.map(k => evalClaim(c, k)), cnt = (r: string) => res.filter(x => x.res === r).length;
  const tl = (t: string) => ({ 'Hospitals within 1 km': L('Hospitals within 1 km', '1 கி.மீ-ல் மருத்துவமனை'), 'Schools within 1 km': L('Schools within 1 km', '1 கி.மீ-ல் பள்ளி'), 'Bus stands within 1 km': L('Bus stands within 1 km', '1 கி.மீ-ல் பேருந்து நிலையம்'), 'Approved layout': L('Approved layout', 'அனுமதி பெற்ற லேஅவுட்'), 'Clear title, no loan': L('Clear title, no loan', 'தெளிவான உரிமை, கடன் இல்லை'), 'Road width 30 ft': L('Road width 30 ft', '30 அடி சாலை'), 'Good groundwater': L('Good groundwater', 'நல்ல நிலத்தடி நீர்') }[t] ?? t);
  const text = () => ({ distance: `${NEARBY_CATS[f.target].label.en} within ${f.km} km`, approval: 'Approved layout', title: 'Clear title, no loan', road: `Road width ${f.value} ft`, price: `Price ₹${f.value}/sq.ft`, groundwater: 'Good groundwater', other: f.text || 'Other claim' }[f.kind]);
  const add = () => { if ((f.kind === 'road' || f.kind === 'price') && !(f.value > 0)) return; if (f.kind === 'other' && !f.text.trim()) return; api.addClaim(c.id, { kind: f.kind, text: text(), target: f.kind === 'distance' ? f.target : undefined, km: f.kind === 'distance' ? f.km : undefined, value: f.value || undefined, guide: f.guide || undefined, by: f.by }); };
  const by = (x?: string) => ({ broker: L('Broker', 'தரகர்'), seller: L('Seller', 'விற்பவர்'), agent: L('Agent', 'முகவர்') }[x ?? 'broker']);
  const tiles: [string, number, '' | 'a' | 'r' | 'n'][] = [[L('Consistent', 'ஒத்துப்போகிறது'), cnt('supported'), ''], [L('Partly supported', 'பகுதி உறுதி'), cnt('partial'), 'a'], [L('Not supported', 'உறுதியில்லை'), cnt('not'), 'r'], [L('Not verified', 'சரிபார்க்கவில்லை'), cnt('unverified'), 'n']];
  return <div className="col">
    <div className="g c4">{tiles.map(t => <div className="panel stat" key={t[0]}><Tag tone={t[2]}>{t[0]}</Tag><b><Num v={t[1]} /></b></div>)}</div>
    <div className="g c21">
      <div className="panel">{!c.claims.length ? <Empty title={L('No claims yet', 'கூற்றுகள் இல்லை')} hint={L('Add what the broker or seller told you, using the quick-add list or the form. We check each one against your documents and the map, and say what proof is still needed.', 'தரகர் / விற்பவர் சொன்னதை சேர்க்கவும். ஆவணங்கள், வரைபடத்துடன் சரிபார்த்து, இன்னும் என்ன ஆதாரம் தேவை என்று சொல்வோம்.')} /> :
        c.claims.map((k, i) => { const r = res[i]; return <div className="find" key={k.id}>
          <div className="row wrap"><b className="sp">{L('Says: ', 'கூறுவது: ')}{tl(k.text)}</b><Tag tone="n">{by(k.by)}</Tag><Tag tone={claimTone(r.res)}>{claimLabel(r.res, L)}</Tag>{!ro && <button className="btn o sm" onClick={() => api.removeClaim(c.id, k.id)}>{L('Remove', 'நீக்கு')}</button>}</div>
          <p style={{ margin: '8px 0' }}>{B(r.note)}</p>
          {(r.needed || r.who || r.next) && <div className="g c3" style={{ gap: 12 }}>{([[L('Proof still needed', 'தேவையான ஆதாரம்'), r.needed], [L('Who can verify', 'யார் சரிபார்க்கலாம்'), r.who], [L('Next step', 'அடுத்த படி'), r.next]] as const).map(([h, v]) => v && <div key={h}><div className="mu sm">{h}</div><div>{B(v)}</div></div>)}</div>}</div>; })}</div>
      {!ro && <div className="col">
        <div className="panel pad"><h3 style={{ marginBottom: 10 }}>{L('Quick add', 'விரைவாக சேர்')}</h3><div className="row wrap" style={{ gap: 8 }}>{TEMPLATES.map(t => <button key={t.text} className="chip" onClick={() => api.addClaim(c.id, { ...t, by: 'broker' })}>+ {tl(t.text)}</button>)}</div></div>
        <div className="panel pad"><h3 style={{ marginBottom: 12 }}>{L('Add your own', 'உங்கள் கூற்றை சேர்')}</h3>
          <div className="g c2" style={{ gap: 12 }}><div className="fld"><label className="f">{L('Said by', 'சொன்னவர்')}</label><select className="in" value={f.by} onChange={e => setF({ ...f, by: e.target.value as typeof f.by })}><option value="broker">{L('Broker', 'தரகர்')}</option><option value="seller">{L('Seller', 'விற்பவர்')}</option><option value="agent">{L('Agent', 'முகவர்')}</option></select></div>
            <div className="fld"><label className="f">{L('About', 'பற்றி')}</label><select className="in" value={f.kind} onChange={e => setF({ ...f, kind: e.target.value as Claim['kind'] })}>{([['distance', L('Distance to a facility', 'வசதிக்கான தூரம்')], ['approval', L('Approved layout', 'அனுமதி பெற்ற லேஅவுட்')], ['title', L('Clear title', 'தெளிவான உரிமை')], ['road', L('Road width', 'சாலை அகலம்')], ['price', L('Price', 'விலை')], ['groundwater', L('Groundwater', 'நிலத்தடி நீர்')], ['other', L('Something else', 'வேறு')]] as const).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div></div>
          {f.kind === 'distance' && <div className="g c2" style={{ gap: 12 }}><div className="fld"><label className="f">{L('Facility', 'வசதி')}</label><select className="in" value={f.target} onChange={e => setF({ ...f, target: e.target.value })}>{Object.entries(NEARBY_CATS).map(([k, v]) => <option key={k} value={k}>{B(v.label)}</option>)}</select></div><div className="fld"><label className="f">{L('Within (km)', 'தூரம் (கி.மீ)')}</label><input className="in" type="number" min={0.1} step={0.1} value={f.km} onChange={e => setF({ ...f, km: +e.target.value })} /></div></div>}
          {f.kind === 'road' && <div className="fld"><label className="f">{L('Width claimed (ft)', 'கூறிய அகலம் (அடி)')}</label><input className="in" type="number" value={f.value || ''} onChange={e => setF({ ...f, value: +e.target.value })} /></div>}
          {f.kind === 'price' && <div className="g c2" style={{ gap: 12 }}><div className="fld"><label className="f">{L('Asking ₹ per sq.ft', 'கேட்கும் விலை ₹/ச.அடி')}</label><input className="in" type="number" value={f.value || ''} onChange={e => setF({ ...f, value: +e.target.value })} /></div><div className="fld"><label className="f">{L('Guideline ₹ per sq.ft', 'வழிகாட்டி ₹/ச.அடி')}</label><input className="in" type="number" value={f.guide || ''} onChange={e => setF({ ...f, guide: +e.target.value })} /></div></div>}
          {f.kind === 'other' && <div className="fld"><label className="f">{L('What was said', 'என்ன சொன்னார்')}</label><input className="in" value={f.text} onChange={e => setF({ ...f, text: e.target.value })} /></div>}
          <button className="btn" onClick={add}>{L('Add claim', 'கூற்றை சேர்')}</button></div>
        <div className="panel pad"><h3 style={{ marginBottom: 8 }}>{L('How claims are checked', 'கூற்றுகள் எப்படி சரிபார்க்கப்படுகின்றன')}</h3><ul className="mu" style={{ margin: 0, paddingLeft: 18 }}><li>{L('Distance: against OpenStreetMap, in a straight line. A road is never shorter, so a straight line can disprove a claim but not fully prove it.', 'தூரம்: OpenStreetMap, நேர்கோட்டில். சாலை நேர்கோட்டை விட குறைவாகாது; எனவே நேர்கோடு கூற்றை மறுக்கலாம், முழுமையாக நிரூபிக்க முடியாது.')}</li><li>{L('Title and approval: against your documents. The seller’s own paper is never treated as official confirmation.', 'உரிமை, அனுமதி: உங்கள் ஆவணங்களுடன். விற்பவரின் ஆவணம் அதிகாரப்பூர்வ உறுதியாக கருதப்படாது.')}</li><li>{L('Price: against the guideline value you enter.', 'விலை: நீங்கள் உள்ளிடும் வழிகாட்டி மதிப்புடன்.')}</li><li>{L('Road width and groundwater: no source yet, so we tell you who can verify.', 'சாலை அகலம், நிலத்தடி நீர்: மூலம் இல்லை; யார் சரிபார்க்கலாம் என்று சொல்கிறோம்.')}</li></ul></div>
      </div>}
    </div></div>;
}

function AuditTab({ c, ro }: { c: Case; ro: boolean }) {
  const { L, B, lang } = useL(), sev = useSev(), s = useStore(), [er, setEr] = useState(''), a = c.audit, rv = s.reviews.filter(r => r.caseId === c.id), u = s.users.find(x => x.id === s.session)!;
  const [step, setStep] = useState(-1), names = [L('Reading your documents', 'ஆவணங்களை படிக்கிறது'), L('Comparing documents with each other', 'ஆவணங்களை ஒப்பிடுகிறது'), L('Checking claims against the map', 'கூற்றுகளை வரைபடத்துடன் சரிபார்க்கிறது'), L('Scoring the evidence', 'ஆதாரத்தை மதிப்பிடுகிறது'), L('Preparing your report', 'அறிக்கையை தயாரிக்கிறது')];
  const run = () => {
    if (step >= 0) return; if (!c.paid && u.credits < 1) { setEr(L('You have no credits left. Buy a pack to run this audit.', 'கிரெடிட் இல்லை. தணிக்கைக்கு ஒரு பேக் வாங்கவும்.')); return; }
    setEr(''); setStep(0); let i = 0; const t = setInterval(() => { i++; if (i >= names.length) { clearInterval(t); api.runAudit(c.id); setStep(-1); } else setStep(i); }, 520);
  };
  const overlay = step >= 0 && <div className="ovl" role="status" aria-live="polite"><div className="box"><h2 style={{ marginBottom: 4 }}>{L('Analysing your case', 'உங்கள் வழக்கை பகுப்பாய்வு செய்கிறது')}</h2><div className="mu sm" style={{ marginBottom: 14 }}>{L('This takes a few seconds.', 'சில நொடிகள் ஆகும்.')}</div>{names.map((n, i) => <div key={i} className={`stp ${i <= step ? 'on' : ''} ${i === step ? 'cur' : ''}`}><i>{i < step ? '✓' : ''}</i>{n}</div>)}<div className="bar" style={{ marginTop: 16 }}><i style={{ width: ((step + 1) / names.length) * 100 + '%', transition: 'width .5s', animation: 'none', transform: 'none' }} /></div></div></div>;
  if (!a) return <>{overlay}<div className="panel"><Empty title={L('Ready to audit?', 'தணிக்கைக்கு தயாரா?')} hint={L(`We will cross-check ${c.docs.length} document(s), your claims and the map data. Cost: ${c.paid ? 'free (already paid)' : '1 credit'}. You have ${u.credits}.`, `${c.docs.length} ஆவணங்கள், கூற்றுகள், வரைபட தரவை ஒப்பிடுவோம். கட்டணம்: ${c.paid ? 'இலவசம்' : '1 கிரெடிட்'}. உங்களிடம்: ${u.credits}.`)}>
    {!ro && <button className="btn" onClick={run} disabled={!c.docs.length}>{L('Run audit', 'தணிக்கையை இயக்கு')}</button>}<div className="err">{er} {er && <Link to="/plans">{L('Plans', 'திட்டங்கள்')}</Link>}</div>{!c.docs.length && <div className="mu sm">{L('Add at least one document first.', 'முதலில் ஒரு ஆவணமாவது சேர்க்கவும்.')}</div>}</Empty></div></>;
  const ev = (k: Review['kind']) => ({ advocate: L('Advocate', 'வழக்கறிஞர்'), surveyor: L('Surveyor', 'சர்வேயர்'), planner: L('Planner', 'திட்ட நிபுணர்'), valuer: L('Valuer', 'மதிப்பீட்டாளர்') }[k]);
  return <div className="col">{overlay}
    <div className="panel pad row wrap" style={{ gap: 28 }}><Ring v={a.total} tone={a.tone} />
      <div style={{ flex: 1, minWidth: 260 }}><h2>{B(a.verdict)}</h2><div className="mu" style={{ margin: '4px 0 12px' }}>{L('Score covers only what was checked. Evidence coverage tells you how much that is.', 'மதிப்பெண் சரிபார்த்தவற்றை மட்டும் உள்ளடக்கியது. ஆதார வரம்பு அதன் அளவை காட்டும்.')}</div>
        <div className="row"><span style={{ width: 130 }}>{L('Evidence coverage', 'ஆதார வரம்பு')}</span><div className="bar"><i style={{ width: a.coverage + '%' }} /></div><b>{a.coverage}%</b></div>
        <div className="row wrap" style={{ marginTop: 12 }}><Tag tone={a.counts.critical ? 'r' : 'n'}>{a.counts.critical} {L('critical', 'மிக முக்கியம்')}</Tag><Tag tone={a.counts.high ? 'r' : 'n'}>{a.counts.high} {L('high', 'உயர்')}</Tag><Tag tone={a.counts.verify ? 'a' : 'n'}>{a.counts.verify} {L('to verify', 'சரிபார்க்க')}</Tag><Tag tone="n">{a.counts.pending} {L('not checked', 'சரிபார்க்கப்படவில்லை')}</Tag></div></div>
      <div className="col" style={{ gap: 8 }}><DlButton c={c} />{!ro && <button className="btn o" onClick={run}>{L('Re-run (free)', 'மீண்டும் இயக்கு (இலவசம்)')}</button>}</div></div>
    <DownloadPanel c={c} />
    <div className="g c2">
      <div className="panel"><div className="ph"><h3>{L('Score breakdown', 'மதிப்பெண் விவரம்')}</h3></div>{a.cats.map(x => <div className="row" key={x.cat} style={{ padding: '10px 20px', borderBottom: '1px solid var(--line)' }}><span style={{ width: 150 }}>{B(CAT_LABEL[x.cat])}</span><div className="bar"><i style={{ width: x.assessed ? (x.got / x.max) * 100 + '%' : 0 }} /></div>{x.assessed ? <b style={{ width: 54, textAlign: 'right' }}>{x.got}/{x.max}</b> : <Tag tone="n">{L('Not checked', 'சரிபார்க்கவில்லை')}</Tag>}</div>)}</div>
      <div className="panel"><div className="ph"><h3>{L('Not checked yet', 'இன்னும் சரிபார்க்கப்படாதவை')}</h3></div>{a.pending.map((p, i) => <div key={i} className="row" style={{ padding: '10px 20px', borderBottom: '1px solid var(--line)' }}><Prov kind="none" /><span>{B(p)}</span></div>)}</div>
    </div>
    <div className="panel"><div className="ph"><h3>{L('Findings', 'முடிவுகள்')}</h3></div>
      {!a.findings.length ? <Empty title={L('No issues found in what was checked', 'சரிபார்த்தவற்றில் சிக்கல் இல்லை')} /> : [...a.findings].sort((x, y) => ['critical', 'high', 'medium', 'low', 'info'].indexOf(x.sev) - ['critical', 'high', 'medium', 'low', 'info'].indexOf(y.sev)).map(f => <div key={f.id} className={`find ${f.sev}`}>
        <div className="row wrap"><Tag tone={sevTone(f.sev)}>{sev(f.sev)}</Tag><b className="sp">{B(f.title)}</b><span className="mu sm">{f.id} · {L('confidence', 'நம்பகம்')} {f.conf}% · {B(CAT_LABEL[f.cat])}</span></div>
        <p style={{ margin: '6px 0' }}>{B(f.why)}</p><div className="row wrap" style={{ gap: 6 }}>{f.evidence.map(e => <span className="ev" key={e}>{e}</span>)}</div>
        <p style={{ margin: '8px 0 0' }}><b>{L('Do this: ', 'செய்ய வேண்டியது: ')}</b>{B(f.action)}</p></div>)}</div>
    <div className="panel pad"><h3 style={{ marginBottom: 6 }}>{L('Need a professional opinion?', 'நிபுணர் கருத்து வேண்டுமா?')}</h3><div className="mu" style={{ marginBottom: 12 }}>{L('AI cannot certify title or boundaries. Request a review and an admin will assign a professional.', 'AI உரிமை / எல்லையை சான்றளிக்க முடியாது. மதிப்பாய்வு கோருங்கள்; நிர்வாகி நிபுணரை நியமிப்பார்.')}</div>
      {!ro && <div className="row wrap">{(['advocate', 'surveyor', 'planner', 'valuer'] as const).map(k => <button key={k} className="btn o sm" onClick={() => api.requestReview(c.id, k)}>{ev(k)}</button>)}</div>}
      {rv.map(r => <div className="row" key={r.id} style={{ padding: '10px 0', borderTop: '1px solid var(--line)', marginTop: 10 }}><b>{ev(r.kind)}</b><Tag tone={r.status === 'completed' ? '' : r.status === 'assigned' ? 'b' : 'a'}>{r.status}</Tag><span className="mu sm">{date(r.at, lang)}</span>{r.assignee && <span className="sm">{r.assignee}</span>}{r.remark && <span className="sm">“{r.remark}”</span>}</div>)}</div>
  </div>;
}

function Assistant({ c }: { c: Case }) {
  const { L, B, lang } = useL(), a = c.audit, [msgs, setMsgs] = useState<{ u?: boolean; t: string }[]>([{ t: L('Ask about this case. I answer only from its documents, findings and map data, and I cite the finding IDs.', 'இந்த வழக்கை பற்றி கேளுங்கள். ஆவணங்கள், முடிவுகள், வரைபட தரவிலிருந்து மட்டும் பதிலளிப்பேன்; முடிவு எண்களை குறிப்பிடுவேன்.') }]), [q, setQ] = useState('');
  const reply = (x: string): string => {
    if (!a) return L('Run the audit first. Until then there is nothing to explain.', 'முதலில் தணிக்கையை இயக்கவும்.');
    const f = a.findings, t = x.toLowerCase(), list = (arr: typeof f) => arr.map(i => `• [${i.id}] ${B(i.title)}`).join('\n');
    if (/why|score|மதிப்பெண்/.test(t)) return L(`Score ${a.total}/100 on ${a.coverage}% evidence coverage.\n${a.counts.critical ? 'A critical finding caps the score at 59.\n' : ''}Biggest deductions:\n${list(f.filter(i => i.sev !== 'info').slice(0, 4)) || 'none'}`, `மதிப்பெண் ${a.total}/100; ஆதார வரம்பு ${a.coverage}%.\n${a.counts.critical ? 'மிக முக்கிய முடிவு மதிப்பெண்ணை 59-க்குள் வைக்கிறது.\n' : ''}முக்கிய குறைப்புகள்:\n${list(f.filter(i => i.sev !== 'info').slice(0, 4)) || 'இல்லை'}`);
    if (/mismatch|பொருந்த/.test(t)) return list(f.filter(i => /mismatch|match|பொருந்த/i.test(i.title.en + i.title.ta))) || L('No document mismatches found in what was checked.', 'சரிபார்த்தவற்றில் பொருந்தாமை இல்லை.');
    if (/pending|not checked|இன்னும்|சரிபார்க்க/.test(t)) return a.pending.map(p => '• ' + B(p)).join('\n');
    if (/seller|ask|கேட்க/.test(t)) return L('Ask the seller for:\n', 'விற்பவரிடம் கேட்க:\n') + (f.filter(i => i.sev !== 'info').map(i => `• ${B(i.action)} [${i.id}]`).join('\n') || L('• Nothing urgent from the checks so far.', '• இதுவரை அவசரம் இல்லை.'));
    if (/ec\b|encumb|வில்லங்க/.test(t)) { const e = c.docs.find(d => d.type === 'ec'); return e ? L(`EC covers ${e.fields.period?.v} with ${e.fields.entries?.v} entries. ${list(f.filter(i => /encumbrance|வில்லங்க/i.test(i.title.en + i.title.ta)))}`, `EC காலம் ${e.fields.period?.v}; பதிவுகள் ${e.fields.entries?.v}.`) : L('No EC uploaded.', 'EC பதிவேற்றப்படவில்லை.'); }
    if (/risk|அபாய/.test(t)) return list(f) || L('No findings.', 'முடிவுகள் இல்லை.');
    return L('I can explain the score, list mismatches, show pending checks, suggest what to ask the seller, or explain the EC.', 'மதிப்பெண், பொருந்தாமை, நிலுவை சரிபார்ப்புகள், விற்பவரிடம் கேட்பவை, EC பற்றி விளக்குவேன்.');
  };
  const mic = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!SR) { setMsgs(m => [...m, { t: L('Voice input is not supported in this browser. Try Chrome.', 'இந்த உலாவியில் குரல் உள்ளீடு இல்லை. Chrome முயற்சிக்கவும்.') }]); return; }
    const r = new SR(); r.lang = lang === 'ta' ? 'ta-IN' : 'en-IN'; r.onresult = (e: any) => setQ(e.results[0][0].transcript); r.start(); // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  const send = (x: string) => { if (!x.trim()) return; setMsgs(m => [...m, { u: true, t: x }, { t: reply(x) }]); setQ(''); };
  const sug = [L('Why is my score ' + (a?.total ?? '') + '?', 'என் மதிப்பெண் ஏன்?'), L('Show all mismatches', 'பொருந்தாமைகளை காட்டு'), L('Which checks are pending?', 'எந்த சரிபார்ப்புகள் நிலுவை?'), L('What should I ask the seller?', 'விற்பவரிடம் என்ன கேட்க?'), L('Explain the EC', 'EC-ஐ விளக்கு')];
  return <div className="g c21">
    <div className="panel"><div className="chat" aria-live="polite">{msgs.map((m, i) => <div key={i} className={`m ${m.u ? 'u' : ''}`}>{m.t}</div>)}</div>
      <div className="row" style={{ padding: 14, borderTop: '1px solid var(--line)' }}><button className="btn o" title={L('Speak', 'பேசுங்கள்')} onClick={() => mic()}>{L('Speak', 'பேசு')}</button><input className="in" value={q} placeholder={L('Ask about this case…', 'இந்த வழக்கை பற்றி கேளுங்கள்…')} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && send(q)} /><button className="btn" onClick={() => send(q)}>{L('Send', 'அனுப்பு')}</button></div></div>
    <div className="panel pad" style={{ alignSelf: 'start' }}><h3 style={{ marginBottom: 10 }}>{L('Suggested', 'பரிந்துரை')}</h3><div className="col" style={{ gap: 8 }}>{sug.map(s => <button key={s} className="chip" style={{ textAlign: 'left', borderRadius: 6 }} onClick={() => send(s)}>{s}</button>)}</div>
      <div className="mu sm" style={{ marginTop: 14 }}>{L('Demo answers come from the audit rules. A language model with retrieval over the same evidence plugs in at api.ts.', 'டெமோ பதில்கள் தணிக்கை விதிகளிலிருந்து. அதே ஆதாரத்தின் மீது மொழி மாதிரி api.ts-ல் இணையும்.')} {lang === 'ta' ? '' : ''}</div></div>
  </div>;
}

function DlButton({ c }: { c: Case }) {
  const { L, lang } = useL(), [busy, setBusy] = useState(false);
  return <button className="btn" disabled={busy} onClick={async () => { setBusy(true); try { await downloadReport(c, lang, ALL_OPT); } catch (e) { console.error(e); } setBusy(false); }}>{busy ? L('Preparing PDF…', 'PDF தயாராகிறது…') : L('Download report (PDF)', 'அறிக்கை PDF பதிவிறக்கு')}</button>;
}

export function Report({ c }: { c: Case }) {
  const { lang: appLang } = useL(), [rl, setRl] = useState<'en' | 'ta'>(appLang), [map, setMap] = useState<string | undefined>(), L: LFn = (en, ta) => (rl === 'ta' ? ta : en);
  useEffect(() => { let on = true; staticMap(c).then(u => on && setMap(u)); return () => { on = false; }; }, [c.lat, c.lng, c.extent]);
  if (!c.audit) return <div className="panel"><Empty title={L('No report yet', 'அறிக்கை இல்லை')} hint={L('Run the audit to generate the report.', 'அறிக்கைக்கு தணிக்கையை இயக்கவும்.')}><Link to={`/cases/${c.id}/audit`} className="btn">{L('Go to audit', 'தணிக்கைக்கு')}</Link></Empty></div>;
  return <div>
    <div className="row noprint" style={{ marginBottom: 14 }}><div className="sp" /><select className="in" style={{ width: 'auto' }} value={rl} onChange={e => setRl(e.target.value as 'en' | 'ta')}><option value="en">English</option><option value="ta">தமிழ்</option></select><button className="btn o" onClick={() => window.print()}>{L('Print', 'அச்சிடு')}</button><DlButtonLang c={c} lang={rl} /></div>
    <div className="paper flush"><ReportDoc c={c} lang={rl} mapUrl={map} /></div>
  </div>;
}
function DlButtonLang({ c, lang }: { c: Case; lang: 'en' | 'ta' }) {
  const [busy, setBusy] = useState(false); const L: LFn = (en, ta) => (lang === 'ta' ? ta : en);
  return <button className="btn" disabled={busy} onClick={async () => { setBusy(true); try { await downloadReport(c, lang, ALL_OPT); } catch (e) { console.error(e); } setBusy(false); }}>{busy ? L('Preparing PDF…', 'PDF தயாராகிறது…') : L('Download PDF', 'PDF பதிவிறக்கு')}</button>;
}

const SHEET: Record<string, string> = {
  sale_deed: 'SALE DEED|Document No. {docno}. This deed is made by {seller} (the Vendor) in favour of the Purchaser, in respect of land situated at {village}, bearing Survey No. {survey}, measuring {extent} sq.ft.',
  parent: 'PARENT DEED|Document No. {docno}. {seller} (the Vendor) conveys to {buyer} the land at Survey No. {survey}, measuring {extent} sq.ft.',
  patta: 'PATTA|Village: {village}. Patta holder: {holder}. Survey No. {survey}. Extent: {extent} sq.ft.',
  chitta: 'CHITTA|Owner: {holder}. Survey No. {survey}. Extent: {extent} sq.ft.',
  ec: 'ENCUMBRANCE CERTIFICATE|Survey No. {survey}. Period searched: {period}. Number of entries found: {entries}.',
  fmb: 'FIELD MEASUREMENT BOOK SKETCH|Survey No. {survey}. Measured extent: {extent} sq.ft.',
  approval: 'LAYOUT APPROVAL|Issued by {authority}. Reference {ref}. Applies to Survey No. {survey}.',
  tax: 'TAX RECEIPT|Paid by {holder} for Survey No. {survey}. Period {period}.',
};
function DocViewer({ d, hot, setHot }: { d: import('../types').Doc; hot: string; setHot: (k: string) => void }) {
  const { L } = useL(), [title, body] = (SHEET[d.type] ?? 'DOCUMENT|').split('|');
  const parts = body.split(/(\{\w+\})/g);
  return <div className="g c2" style={{ padding: 20, borderBottom: '1px solid var(--line)' }}>
    <div className="sheet"><h4>{title}</h4>{parts.map((p, i) => { const k = p.match(/^\{(\w+)\}$/)?.[1]; return k && d.fields[k] ? <mark key={i} className={`hl ${hot === k ? 'on' : ''}`} onMouseEnter={() => setHot(k)} onClick={() => setHot(k)}>{d.fields[k].v}</mark> : <span key={i}>{p}</span>; })}</div>
    <div className="mu sm"><b style={{ color: 'var(--ink)' }}>{hot ? `${L('Selected', 'தேர்வு')}: ${hot}` : L('Hover a highlighted value', 'சிறப்பிக்கப்பட்ட மதிப்பின் மேல் செல்க')}</b>{hot && d.fields[hot] && <p>{L('Read from page', 'படித்த பக்கம்')} {d.fields[hot].page} · {d.fields[hot].conf}% {L('sure', 'உறுதி')}</p>}
      <p>{L('This preview is typeset from the extracted values so you can see what the engine reads. Viewing the original scan needs file storage, which comes with the backend.', 'பிரித்தெடுத்த மதிப்புகளிலிருந்து அமைக்கப்பட்ட முன்னோட்டம் இது. அசல் ஸ்கேனை பார்க்க கோப்பு சேமிப்பு தேவை; backend-உடன் வரும்.')}</p></div></div>;
}

function Chain({ c }: { c: Case }) {
  const { L, B } = useL(), nodes = buildChain(c);
  return <div className="g c21"><div className="panel pad"><h3 style={{ marginBottom: 4 }}>{L('Ownership and record chain', 'உரிமை, பதிவு சங்கிலி')}</h3><div className="mu" style={{ marginBottom: 20 }}>{L('Oldest document first. A link turns amber when it disagrees with the next one, and grey when the document was not provided.', 'பழைய ஆவணம் முதலில். அடுத்ததுடன் முரண்பட்டால் மஞ்சள்; ஆவணம் இல்லையெனில் சாம்பல்.')}</div>
    <div className="chain">{nodes.map(n => <div className="cn" key={n.key}><span className={`dot ${n.status === 'ok' ? 'ok' : n.status === 'warn' ? 'am' : ''}`} /><div className="row wrap"><b>{B(n.title)}</b><Tag tone={n.status === 'ok' ? '' : n.status === 'warn' ? 'a' : 'n'}>{n.status === 'ok' ? L('Consistent', 'ஒத்துப்போகிறது') : n.status === 'warn' ? L('Check this link', 'இந்த இணைப்பை சரிபார்') : L('Not provided', 'வழங்கப்படவில்லை')}</Tag></div>{n.who && <div>{n.who}</div>}<div className="mu">{B(n.detail)}</div></div>)}</div></div>
    <div className="panel pad" style={{ alignSelf: 'start' }}><h3 style={{ marginBottom: 8 }}>{L('Why a chain', 'ஏன் சங்கிலி')}</h3><p className="mu" style={{ margin: 0 }}>{L('A clean patta today does not prove the seller received the land lawfully. The chain shows each transfer so a gap is visible before you pay.', 'இன்றைய தெளிவான பட்டா, விற்பவர் நிலத்தை முறையாக பெற்றார் என்பதை நிரூபிக்காது. ஒவ்வொரு மாற்றமும் தெரிவதால் இடைவெளி பணம் கொடுக்கும் முன்பே தெரியும்.')}</p></div></div>;
}

function Questions({ c }: { c: Case }) {
  const { L, B, lang } = useL(), qs = sellerQuestions(c), [done, setDone] = useState(false);
  const text = `${L('Questions before I proceed', 'முன்னேறும் முன் என் கேள்விகள்')} (${c.village || c.district}, S.No ${c.survey}):\n` + qs.map((x, i) => `${i + 1}. ${B(x.q)}`).join('\n');
  return <div className="g c21"><div className="panel"><div className="ph"><h3>{L('Ask the seller', 'விற்பவரிடம் கேளுங்கள்')}</h3><div className="sp" /><span className="mu sm">{qs.length} {L('questions', 'கேள்விகள்')}</span></div>
    {qs.map((x, i) => <div className="row" key={i} style={{ padding: '12px 20px', borderBottom: '1px solid var(--line)', alignItems: 'flex-start' }}><b style={{ width: 22 }}>{i + 1}.</b><span className="sp">{B(x.q)}</span>{x.ref && <span className="ev">{x.ref}</span>}</div>)}</div>
    <div className="panel pad" style={{ alignSelf: 'start' }}><h3 style={{ marginBottom: 8 }}>{L('Send it', 'அனுப்புங்கள்')}</h3><p className="mu" style={{ marginTop: 0 }}>{L('Questions come from this case’s findings and from what is still missing. Written answers are worth keeping.', 'கேள்விகள் இந்த வழக்கின் முடிவுகள், விடுபட்டவற்றிலிருந்து. எழுத்து பதில்களை சேமியுங்கள்.')} {lang === 'ta' ? '' : ''}</p>
      <div className="col" style={{ gap: 8 }}><a className="btn" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(text)}`}>{L('Send on WhatsApp', 'WhatsApp-ல் அனுப்பு')}</a><button className="btn o" onClick={() => { navigator.clipboard?.writeText(text); setDone(true); }}>{done ? L('Copied', 'நகலெடுக்கப்பட்டது') : L('Copy text', 'உரையை நகலெடு')}</button></div></div></div>;
}

function Share({ c, ro }: { c: Case; ro: boolean }) {
  const { L } = useL(), on = !!c.share?.on, url = c.share ? `${location.origin}${location.pathname}#/share/${c.share.token}` : '', [qr, setQr] = useState(''), [ok, setOk] = useState(false);
  useEffect(() => { if (on) QRCode.toDataURL(url, { margin: 1, width: 180 }).then(setQr); else setQr(''); }, [on, url]);
  return <div className="g c2"><div className="panel pad"><h3 style={{ marginBottom: 6 }}>{L('Share this report', 'இந்த அறிக்கையை பகிர்')}</h3><p className="mu" style={{ marginTop: 0 }}>{L('Anyone with the link can read the report, not edit it. Turn it off and the link stops working.', 'இணைப்பு உள்ளவர் அறிக்கையை படிக்கலாம்; திருத்த முடியாது. நிறுத்தினால் இணைப்பு செயலிழக்கும்.')}</p>
    {!c.audit ? <div className="err">{L('Run the audit before sharing.', 'பகிரும் முன் தணிக்கையை இயக்கவும்.')}</div> : <>
      {!ro && <button className={`btn ${on ? 'o' : ''}`} onClick={() => api.toggleShare(c.id)}>{on ? L('Turn sharing off', 'பகிர்வை நிறுத்து') : L('Create share link', 'பகிர்வு இணைப்பை உருவாக்கு')}</button>}
      {on && <div style={{ marginTop: 14 }}><input className="in" readOnly value={url} onFocus={e => e.target.select()} /><div className="row" style={{ marginTop: 10 }}><button className="btn o sm" onClick={() => { navigator.clipboard?.writeText(url); setOk(true); }}>{ok ? L('Copied', 'நகலெடுக்கப்பட்டது') : L('Copy link', 'இணைப்பை நகலெடு')}</button><a className="btn o sm" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(url)}`}>WhatsApp</a></div>
        <p className="mu sm">{L('Demo: this link opens only in this browser because data is stored locally. With a backend it works anywhere.', 'டெமோ: தரவு உலாவியில் சேமிக்கப்படுவதால் இந்த இணைப்பு இங்கு மட்டுமே திறக்கும். backend இருந்தால் எங்கும் செயல்படும்.')}</p></div>}</>}</div>
    <div className="panel pad" style={{ textAlign: 'center' }}>{qr ? <><img src={qr} alt="QR" width={180} height={180} /><div className="mu sm">{L('Scan to open the report', 'அறிக்கையை திறக்க ஸ்கேன் செய்')}</div><div className="ev" style={{ display: 'inline-block', marginTop: 8 }}>ID {c.id}-{c.share?.token}</div></> : <div className="mu" style={{ padding: 40 }}>{L('QR appears when sharing is on.', 'பகிர்வு இயக்கத்தில் இருந்தால் QR தெரியும்.')}</div>}</div></div>;
}
