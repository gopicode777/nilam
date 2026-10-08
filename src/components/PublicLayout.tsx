import { Link, Outlet, useLocation } from 'react-router-dom';
import { useL } from '../i18n';
import { useStore } from '../store';
import { LangSwitch } from './Shell';
import { Logo } from '../ui';

export default function PublicLayout() {
  const { L } = useL(), s = useStore(), inApp = !!s.session, loc = useLocation();
  return <div className="pub">
    <nav className="pub-nav"><div className="pill">
      <Link to="/" style={{ textDecoration: 'none' }}><Logo /></Link>
      <div className="row" style={{ gap: 26, marginLeft: 14 }}><Link className="l" to="/#how">{L('How it works', 'எப்படி செயல்படுகிறது')}</Link><Link className="l" to="/sample">{L('Sample report', 'மாதிரி அறிக்கை')}</Link><Link className="l" to="/pricing">{L('Pricing', 'கட்டணம்')}</Link></div>
      <div className="sp" /><LangSwitch />
      {inApp ? <Link className="btn" to="/">{L('Open app', 'செயலியை திற')}</Link> : <><Link className="l" to="/login">{L('Log in', 'உள்நுழை')}</Link><Link className="btn" to="/register">{L('Start free', 'இலவசமாக தொடங்கு')}</Link></>}
    </div></nav>
    <div key={loc.pathname} className="page"><Outlet /></div>
    <footer className="foot"><div className="pub-in"><div className="g">
      <div><Logo light /><p style={{ maxWidth: 300, marginTop: 12 }}>{L('Land due-diligence for Tamil Nadu buyers. Evidence first, in English and தமிழ்.', 'தமிழ்நாடு நில வாங்குபவர்களுக்கான சரிபார்ப்பு. ஆதாரம் முதலில்; ஆங்கிலம் & தமிழ்.')}</p></div>
      <div><h4>{L('Product', 'தயாரிப்பு')}</h4><Link to="/sample">{L('Sample report', 'மாதிரி அறிக்கை')}</Link><Link to="/pricing">{L('Pricing', 'கட்டணம்')}</Link><Link to="/register">{L('Start free', 'இலவசமாக தொடங்கு')}</Link></div>
      <div><h4>{L('Legal', 'சட்டம்')}</h4><Link to="/legal/terms">{L('Terms of use', 'பயன்பாட்டு விதிகள்')}</Link><Link to="/legal/privacy">{L('Privacy', 'தனியுரிமை')}</Link><Link to="/legal/disclaimer">{L('Disclaimer', 'பொறுப்புத் துறப்பு')}</Link></div>
      <div><h4>{L('Contact', 'தொடர்புக்கு')}</h4><a href="mailto:hello@landaudit.ai">hello@landaudit.ai</a><span className="sm">Chennai, Tamil Nadu</span></div>
    </div><p className="sm" style={{ marginTop: 30, borderTop: '1px solid #223028', paddingTop: 16 }}>© 2026 LandAudit. {L('A due-diligence aid, not legal advice.', 'இது சரிபார்ப்பு உதவி; சட்ட ஆலோசனை அல்ல.')}</p></div></footer>
  </div>;
}
