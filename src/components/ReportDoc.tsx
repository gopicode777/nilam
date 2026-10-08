import { CAT_LABEL, DOC_LABEL, FIELD_LABEL, NEARBY_CATS, buildChain, evalClaim, passes, statusRows } from '../engine';
import { useStore } from '../store';
import { Ring } from '../ui';
import type { Bi, Case } from '../types';

export interface ReportOpt { highlights: boolean; findings: boolean; chain: boolean; location: boolean; claims: boolean; documents: boolean; actions: boolean }
export const ALL_OPT: ReportOpt = { highlights: true, findings: true, chain: true, location: true, claims: true, documents: true, actions: true };

/** The report. Laid out like the audit report screen: headline score, status rows, key highlights with map, then detail. Each [data-pdf] block is placed on the PDF without being split across pages. */
export default function ReportDoc({ c, lang, opt = ALL_OPT, mapUrl }: { c: Case; lang: 'en' | 'ta'; opt?: ReportOpt; mapUrl?: string }) {
  const s = useStore(), a = c.audit;
  const L = (en: string, ta: string) => (lang === 'ta' ? ta : en), B = (b: Bi) => (lang === 'ta' ? b.ta : b.en);
  const date = (iso: string) => new Date(iso).toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  if (!a) return null;
  const owner = s.users.find(u => u.id === c.ownerId)?.name ?? '', ranked = a.findings.filter(f => f.sev !== 'info'), hi = passes(c), rows = statusRows(c);
  const sevL = (x: string) => ({ critical: L('Critical', 'மிக முக்கியம்'), high: L('High', 'உயர்'), medium: L('Medium', 'நடுத்தரம்'), low: L('Low', 'குறைவு'), info: L('Info', 'தகவல்') }[x]);
  const sevC = (x: string) => (x === 'critical' || x === 'high' ? 'r' : x === 'medium' ? 'a' : 'b');
  const claimL = (r: string) => ({ supported: L('Consistent', 'ஒத்துப்போகிறது'), partial: L('Partly supported', 'பகுதி உறுதி'), not: L('Not supported', 'உறுதியில்லை'), unverified: L('Not verified', 'சரிபார்க்கப்படவில்லை') }[r]);
  const claimC = (r: string) => (r === 'supported' ? 'ok' : r === 'partial' ? 'a' : r === 'not' ? 'r' : 'n');
  const reviews = s.reviews.filter(r => r.caseId === c.id && r.status === 'completed');
  return <div className="rpt">
    <div className="hd" data-pdf>
      <div><div className="rl">LandAudit</div><h1>{L('Property Audit Report', 'நில தணிக்கை அறிக்கை')}</h1>
        <div className="sub">{L('Survey No.', 'சர்வே எண்')} {c.survey}, {c.village || '-'}, {c.district}, {L('Tamil Nadu', 'தமிழ்நாடு')}</div>
        <div className="mu">{L('Generated on', 'உருவாக்கம்')} {date(a.at)}</div></div>
      <div style={{ textAlign: 'right' }}><div className="mu">{L('Report ID', 'அறிக்கை எண்')}</div><b>{c.id}</b><div className="mu" style={{ marginTop: 6 }}>{L('Prepared for', 'பெறுநர்')}</div><b>{owner}</b></div>
    </div>
    <div className="blk" data-pdf><div className="score">
      <div className="box" style={{ textAlign: 'center' }}><Ring v={a.total} tone={a.tone} size={132} /><b style={{ display: 'block', fontSize: 15 }}>{L('Readiness score', 'தயார்நிலை மதிப்பெண்')}</b>
        <div className="mu" style={{ fontSize: 12.5 }}>{L('Evidence coverage', 'ஆதார வரம்பு')} {a.coverage}%</div></div>
      <div className="box">{rows.map(r => <div className="srow" key={r.label.en}><span>{B(r.label)}</span><span className={`st-${r.tone || 'ok'}`}>{B(r.value)}</span></div>)}
        <div style={{ marginTop: 12 }}><b>{B(a.verdict)}.</b> <span className="mu">{L(`${a.counts.critical} critical, ${a.counts.high} high, ${a.counts.verify} to verify, ${a.counts.pending} checks not done.`, `மிக முக்கியம் ${a.counts.critical}, உயர் ${a.counts.high}, சரிபார்க்க ${a.counts.verify}, செய்யப்படாதவை ${a.counts.pending}.`)}</span></div></div>
    </div></div>

    {opt.highlights && <div className="blk" data-pdf><h2>{L('Key highlights', 'முக்கிய அம்சங்கள்')}</h2><div className="kh">
      <div>{hi.length ? hi.map((x, i) => <div key={i} style={{ padding: '4px 0' }}><span className="tick">✓</span>{B(x)}</div>) : <div className="mu">{L('No checks have passed yet. See findings below.', 'இன்னும் எந்த சரிபார்ப்பும் தேர்ச்சி பெறவில்லை. கீழே முடிவுகளை பார்க்கவும்.')}</div>}</div>
      <div>{mapUrl ? <img src={mapUrl} alt="" style={{ width: '100%', borderRadius: 6, border: '1px solid #E3E4DE', display: 'block' }} /> : <div className="mapph">{c.lat.toFixed(5)}, {c.lng.toFixed(5)}<br />{L('Map unavailable', 'வரைபடம் இல்லை')}</div>}
        <div className="mu" style={{ fontSize: 11, marginTop: 4 }}>{L('Blue box: your plot (approximate). © OpenStreetMap contributors', 'நீல பெட்டி: உங்கள் நிலம் (தோராயம்). © OpenStreetMap')}</div></div></div></div>}

    {opt.findings && <><div className="blk" data-pdf style={{ paddingBottom: 0 }}><h2>{L('Findings and evidence', 'முடிவுகள் & ஆதாரம்')}</h2>{!ranked.length && <div className="mu">{L('No issues found in what was checked.', 'சரிபார்த்தவற்றில் சிக்கல் இல்லை.')}</div>}</div>
      {ranked.map(f => <div className="blk" data-pdf key={f.id}><div className={`fd ${f.sev}`}><div><span className={`pl ${sevC(f.sev)}`}>{sevL(f.sev)}</span> <b>[{f.id}] {B(f.title)}</b></div><div>{B(f.why)}</div>
        <div className="mu" style={{ fontSize: 12.5, marginTop: 4 }}>{L('Evidence', 'ஆதாரம்')}: {f.evidence.join('; ')} · {L('confidence', 'நம்பகம்')} {f.conf}% · {B(CAT_LABEL[f.cat])}</div>
        <div style={{ marginTop: 4 }}><b>{L('Do this: ', 'செய்ய வேண்டியது: ')}</b>{B(f.action)}</div></div></div>)}</>}

    {opt.chain && <div className="blk" data-pdf><h2>{L('Ownership chain', 'உரிமை சங்கிலி')}</h2><table className="rt"><tbody>{buildChain(c).map(n => <tr key={n.key}><td style={{ width: 150 }}><b>{B(n.title)}</b></td><td>{n.who ?? ''}<div className="mu">{B(n.detail)}</div></td><td style={{ width: 110 }}><span className={`pl ${n.status === 'ok' ? 'ok' : n.status === 'warn' ? 'a' : 'n'}`}>{n.status === 'ok' ? L('Consistent', 'ஒத்துப்போகிறது') : n.status === 'warn' ? L('Check', 'சரிபார்') : L('Not provided', 'வழங்கவில்லை')}</span></td></tr>)}</tbody></table></div>}

    {opt.location && <div className="blk" data-pdf><h2>{L('Location and neighbourhood', 'இடம் & சுற்றுப்புறம்')}</h2>{c.nearby ? <table className="rt"><tbody>{Object.entries(c.nearby).map(([k, v]) => <tr key={k}><td style={{ width: 170 }}><b>{B(NEARBY_CATS[k].label)}</b></td><td>{v[0] ? `${v[0].name}, ${v[0].km.toFixed(1)} km` : L('None within radius', 'சுற்றளவில் இல்லை')}</td></tr>)}</tbody></table> : <div className="mu">{L('Not checked.', 'சரிபார்க்கவில்லை.')}</div>}<div className="mu" style={{ fontSize: 12, marginTop: 4 }}>{L('Straight-line distances from the pin. Source: OpenStreetMap.', 'பின்னிலிருந்து நேர்கோட்டு தூரம். மூலம்: OpenStreetMap.')}</div></div>}

    {opt.claims && !!c.claims.length && <div className="blk" data-pdf><h2>{L('Seller and broker claims', 'விற்பவர் / தரகர் கூற்றுகள்')}</h2><table className="rt"><tbody>{c.claims.map(k => { const r = evalClaim(c, k); return <tr key={k.id}><td style={{ width: 190 }}><b>{k.text}</b></td><td style={{ width: 120 }}><span className={`pl ${claimC(r.res)}`}>{claimL(r.res)}</span></td><td>{B(r.note)}{r.next && <div className="mu">{L('Next: ', 'அடுத்து: ')}{B(r.next)}</div>}</td></tr>; })}</tbody></table></div>}

    {opt.documents && <div className="blk" data-pdf><h2>{L('Documents and extracted values', 'ஆவணங்கள் & எடுத்த மதிப்புகள்')}</h2><table className="rt"><tbody>{c.docs.map(d => <tr key={d.id}><td style={{ width: 170 }}><b>{B(DOC_LABEL[d.type])}</b><div className="mu">{d.name}</div></td><td style={{ fontSize: 12.5 }}>{Object.entries(d.fields).map(([k, f]) => `${B(FIELD_LABEL[k] ?? { en: k, ta: k })}: ${f.v}`).join(' · ')}</td><td style={{ width: 120 }}><span className={`pl ${d.verified ? 'ok' : 'n'}`}>{d.verified ? L('Confirmed', 'உறுதி') : L('Unconfirmed', 'உறுதியில்லை')}</span></td></tr>)}</tbody></table></div>}

    {opt.actions && <div className="blk" data-pdf><h2>{L('Action before payment', 'பணம் கொடுக்கும் முன் செய்ய வேண்டியவை')}</h2><ol style={{ margin: 0, paddingLeft: 20 }}>{ranked.map(f => <li key={f.id}>{B(f.action)} <span className="mu">[{f.id}]</span></li>)}{a.pending.slice(0, 4).map((p, i) => <li key={'p' + i}>{B(p)}</li>)}</ol>
      {reviews.map(r => <div key={r.id} className="fd" style={{ borderLeftColor: '#0E7A55', marginTop: 10 }}><b>{L('Professional review', 'நிபுணர் மதிப்பாய்வு')} ({r.kind}): {r.assignee}</b><div>“{r.remark}”</div></div>)}</div>}

    <div className="blk" data-pdf style={{ paddingBottom: 30 }}><div className="disc">{L('This report is a due-diligence aid based on the documents and data listed above. It is not legal advice and does not certify title or boundaries. Items marked “not checked” or “not verified” have no reliable source behind them. For title and boundaries, consult an advocate and a licensed surveyor.', 'இந்த அறிக்கை மேலே உள்ள ஆவணங்கள், தரவை அடிப்படையாக கொண்ட சரிபார்ப்பு உதவி. இது சட்ட ஆலோசனை அல்ல; உரிமை, எல்லையை சான்றளிக்காது. “சரிபார்க்கவில்லை” என்பவற்றுக்கு நம்பகமான மூலம் இல்லை. உரிமை, எல்லைக்கு வழக்கறிஞர், உரிமம் பெற்ற சர்வேயரை அணுகவும்.')}</div></div>
  </div>;
}
