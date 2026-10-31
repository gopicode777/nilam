import { Link } from 'react-router-dom';
import { useStore } from '../store';
import { useL } from '../i18n';
import * as api from '../api';

/** Dashboard checklist. Every step ticks itself from what the user has really done. Can be hidden once they are comfortable. */
export default function GetStarted() {
  const s = useStore(), { L } = useL(), u = s.users.find(x => x.id === s.session);
  if (!u || u.role === 'admin' || u.onboarding?.hidden) return null;
  const mine = s.cases.filter(c => c.ownerId === u.id), first = mine[0];
  const steps: { done: boolean; h: string; p: string; to: string }[] = [
    { done: mine.length > 0, h: L('Add a property', 'சொத்தை சேர்க்கவும்'), p: L('District, village, survey number', 'மாவட்டம், கிராமம், சர்வே எண்'), to: '/new' },
    { done: mine.some(c => c.docs.length > 0), h: L('Upload documents', 'ஆவணங்களை பதிவேற்றவும்'), p: L('Sale deed, patta, EC', 'விற்பனை பத்திரம், பட்டா, EC'), to: first ? `/cases/${first.id}/documents` : '/new' },
    { done: mine.some(c => c.docs.some(d => d.verified)), h: L('Confirm the values', 'மதிப்புகளை உறுதி செய்யவும்'), p: L('Check what was read from your files', 'கோப்புகளிலிருந்து படித்ததை சரிபார்க்கவும்'), to: first ? `/cases/${first.id}/documents` : '/new' },
    { done: mine.some(c => c.audit), h: L('Run your audit', 'தணிக்கையை இயக்கவும்'), p: L('See the score and findings', 'மதிப்பெண்ணையும் கண்டறிதல்களையும் பாருங்கள்'), to: first ? `/cases/${first.id}/audit` : '/new' },
    { done: !!u.onboarding?.asked, h: L('Ask the map assistant', 'வரைபட உதவியாளரிடம் கேளுங்கள்'), p: L('Hospitals, schools, PG hostels', 'மருத்துவமனைகள், பள்ளிகள், PG விடுதிகள்'), to: '/map' },
  ];
  const n = steps.filter(x => x.done).length, all = n === steps.length;
  return <div className="panel pad ob-list" data-tour="checklist" style={{ marginBottom: 20 }}>
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div><b style={{ fontSize: 16 }}>{all ? L('You are all set 🎉', 'நீங்கள் தயார் 🎉') : L('Get started with LandAudit', 'LandAudit-ஐ தொடங்குங்கள்')}</b><div className="mu sm">{n} / {steps.length} {L('done', 'முடிந்தது')}</div></div>
      <div className="sp" /><button className="ob-skip" onClick={() => api.setOnboarding({ hidden: true })}>{all ? L('Hide', 'மறை') : L('Hide checklist', 'பட்டியலை மறை')}</button>
    </div>
    <div className="ob-prog"><i style={{ width: `${(n / steps.length) * 100}%` }} /></div>
    <div className="ob-steps">{steps.map((x, k) => <Link key={k} to={x.to} className={`ob-step ${x.done ? 'done' : ''}`}><span className="ob-c">{x.done ? '✓' : k + 1}</span><span><b>{x.h}</b><small>{x.p}</small></span></Link>)}</div>
  </div>;
}
