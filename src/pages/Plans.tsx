import { useState } from 'react';
import { useStore } from '../store';
import { useL } from '../i18n';
import { Tag, inr, date } from '../ui';
import * as api from '../api';

export default function Plans() {
  const s = useStore(), { L, lang } = useL(), u = s.users.find(x => x.id === s.session)!, [msg, setMsg] = useState('');
  const packs = [{ n: 'Single audit', c: 1, a: 499, d: L('One plot you are about to buy', 'வாங்கப்போகும் ஒரு நிலம்') }, { n: 'Buyer pack', c: 5, a: 1999, d: L('Compare several plots, or a family purchase', 'பல நிலங்களை ஒப்பிட') }, { n: 'Advisor pack', c: 25, a: 7499, d: L('Brokers, advocates and consultants', 'தரகர், வழக்கறிஞர், ஆலோசகர்'), best: true }];
  const tiers = [
    [L('Free', 'இலவசம்'), L('Property input, map, nearby places, document upload, basic OCR, basic findings', 'நில விவரம், வரைபடம், அருகிலுள்ளவை, ஆவண பதிவேற்றம், அடிப்படை OCR')],
    [L('Pro', 'ப்ரோ'), L('Full document analysis, cross-document checks, risk analysis, AI assistant, bilingual report', 'முழு ஆவண பகுப்பாய்வு, ஒப்பீடு, அபாய பகுப்பாய்வு, AI உதவியாளர், இருமொழி அறிக்கை')],
    [L('Professional', 'நிபுணர்'), L('Advocate, surveyor and planning review, priority processing', 'வழக்கறிஞர், சர்வேயர், திட்ட மதிப்பாய்வு, முன்னுரிமை')],
    [L('Business', 'வணிகம்'), L('Bulk audits, team accounts, API, portfolio dashboard, custom branding', 'மொத்த தணிக்கை, குழு கணக்கு, API, தனிப்பயன் முத்திரை')],
  ];
  const mine = s.payments.filter(p => p.userId === u.id);
  return <div className="pg">
    <div className="pg-h"><div><h1>{L('Plans and credits', 'திட்டங்கள் & கிரெடிட்')}</h1><div className="mu">{L('One credit runs one audit. Re-running the same case is free.', '1 கிரெடிட் = 1 தணிக்கை. அதே வழக்கை மீண்டும் இயக்குவது இலவசம்.')}</div></div><div className="sp" /><Tag tone="b">{u.credits} {L('credits left', 'கிரெடிட் உள்ளது')}</Tag></div>
    {msg && <div className="notice" role="status">{msg}</div>}
    <div className="g c3" style={{ marginBottom: 20 }}>{packs.map(p => <div key={p.n} className="panel pad" style={p.best ? { borderColor: 'var(--g)', borderWidth: 2 } : {}}>
      <div className="row"><b>{p.n}</b>{p.best && <Tag>{L('Lowest price per audit', 'குறைந்த விலை')}</Tag>}</div>
      <h1 style={{ margin: '8px 0 2px' }}>{inr(p.a)}</h1><div className="mu sm">{p.c} {L('audits', 'தணிக்கைகள்')} · {inr(Math.round(p.a / p.c))} / {L('audit', 'தணிக்கை')}</div><p>{p.d}</p>
      <button className={`btn ${p.best ? '' : 'o'}`} style={{ width: '100%' }} onClick={() => { api.buyPack(p.n, p.c, p.a); setMsg(L(`${p.n} added (demo checkout, no real payment).`, `${p.n} சேர்க்கப்பட்டது (டெமோ; உண்மை கட்டணம் இல்லை).`)); }}>{L('Buy', 'வாங்கு')}</button></div>)}</div>
    <div className="panel" style={{ marginBottom: 20 }}><div className="ph"><h3>{L('What each level includes', 'ஒவ்வொரு நிலையிலும் உள்ளவை')}</h3></div>
      {tiers.map(t => <div className="row" key={t[0]} style={{ padding: '12px 20px', borderBottom: '1px solid var(--line)', alignItems: 'flex-start' }}><b style={{ width: 120 }}>{t[0]}</b><span className="mu">{t[1]}</span></div>)}</div>
    <div className="panel"><div className="ph"><h3>{L('Limits', 'வரம்புகள்')}</h3></div>
      {[[L('Free audits per new account', 'புதிய கணக்கிற்கு இலவச தணிக்கை'), '1'], [L('Maximum upload per file', 'ஒரு கோப்பு அதிகபட்சம்'), '15 MB'], [L('OTP validity / attempts', 'OTP செல்லுபடி / முயற்சிகள்'), L('10 minutes / 5', '10 நிமிடம் / 5')]].map(r => <div className="row" key={r[0]} style={{ padding: '11px 20px', borderBottom: '1px solid var(--line)' }}><span className="sp">{r[0]}</span><b>{r[1]}</b></div>)}</div>
    {!!mine.length && <div className="panel" style={{ marginTop: 20 }}><div className="ph"><h3>{L('Your purchases', 'உங்கள் வாங்குதல்கள்')}</h3></div>{mine.map(p => <div className="row" key={p.id} style={{ padding: '11px 20px', borderBottom: '1px solid var(--line)' }}><span className="sp">{p.pack}</span><span className="mu">{date(p.at, lang)}</span><b>{inr(p.amount)}</b></div>)}</div>}
  </div>;
}
