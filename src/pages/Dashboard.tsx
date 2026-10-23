import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { useL } from '../i18n';
import { Empty, Num, Tag, date } from '../ui';

export function nextStep(c: import('../types').Case, L: (a: string, b: string) => string): { to: string; text: string } {
  if (!c.docs.length) return { to: 'documents', text: L('Upload documents', 'ஆவணங்களை பதிவேற்றுக') };
  if (c.docs.some(d => !d.verified)) return { to: 'documents', text: L('Confirm extracted values', 'மதிப்புகளை உறுதி செய்க') };
  if (!c.nearby) return { to: 'location', text: L('Analyse location', 'இடத்தை பகுப்பாய்வு செய்க') };
  if (!c.audit) return { to: 'audit', text: L('Run the audit', 'தணிக்கையை இயக்குக') };
  return { to: 'report', text: L('Open report', 'அறிக்கையை திற') };
}

export default function Dashboard() {
  const s = useStore(), { L, lang } = useL(), nav = useNavigate(), uid = s.session!;
  const mine = s.cases.filter(c => c.ownerId === uid);
  const audited = mine.filter(c => c.audit);
  return <div className="pg">
    <div className="pg-h"><div><h1>{L('Your audits', 'உங்கள் தணிக்கைகள்')}</h1><div className="mu">{L('Each property is one case. The case tells you the next step.', 'ஒவ்வொரு நிலமும் ஒரு வழக்கு. அடுத்த படியை வழக்கே சொல்லும்.')}</div></div><div className="sp" /><Link to="/new" className="btn">{L('Start new audit', 'புதிய தணிக்கை தொடங்கு')}</Link></div>
    <div className="g c3" style={{ marginBottom: 20 }}>
      <div className="panel stat"><span className="mu">{L('Cases', 'வழக்குகள்')}</span><b><Num v={mine.length} /></b></div>
      <div className="panel stat"><span className="mu">{L('Audits completed', 'முடிந்த தணிக்கைகள்')}</span><b><Num v={audited.length} /></b></div>
      <div className="panel stat"><span className="mu">{L('Cases needing attention', 'கவனம் தேவை')}</span><b><Num v={audited.filter(c => c.audit!.tone !== 'ok').length} /></b></div>
    </div>
    <div className="panel scroll">
      {!mine.length ? <Empty title={L('No audits yet', 'தணிக்கைகள் இல்லை')} hint={L('Add a property and its documents to get your first report.', 'நிலம் மற்றும் ஆவணங்களை சேர்த்தால் முதல் அறிக்கை கிடைக்கும்.')}><Link to="/new" className="btn">{L('Start new audit', 'புதிய தணிக்கை தொடங்கு')}</Link></Empty> :
        <table className="tbl"><thead><tr><th>{L('Property', 'நிலம்')}</th><th>{L('Created', 'உருவாக்கம்')}</th><th>{L('Documents', 'ஆவணங்கள்')}</th><th>{L('Result', 'முடிவு')}</th><th>{L('Next step', 'அடுத்த படி')}</th></tr></thead><tbody>
          {mine.map(c => { const n = nextStep(c, L); return <tr key={c.id} className="click" onClick={() => nav(`/cases/${c.id}`)}>
            <td><b>{c.village || c.district}, {c.district}</b><div className="mu sm">{c.id} · S.No {c.survey}</div></td><td>{date(c.created, lang)}</td><td>{c.docs.length}</td>
            <td>{c.audit ? <span className="row"><b style={{ fontSize: 18 }}><Num v={c.audit.total} /></b><Tag tone={c.audit.tone === 'ok' ? '' : c.audit.tone === 'warn' ? 'a' : 'r'}>{c.audit.coverage}% {L('evidence', 'ஆதாரம்')}</Tag></span> : <Tag tone="n">{L('Not audited', 'தணிக்கை இல்லை')}</Tag>}</td>
            <td><Link to={`/cases/${c.id}/${n.to}`} onClick={e => e.stopPropagation()}>{n.text}</Link></td></tr>; })}
        </tbody></table>}
    </div>
  </div>;
}
