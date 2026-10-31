import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthSide from '../components/AuthSide';
import { useL } from '../i18n';
import { useStore } from '../store';
import { LangSwitch } from '../components/Shell';
import * as api from '../api';
import { Contours, Logo, Ring } from '../ui';

function Frame({ children, side = 'chat' }: { children: React.ReactNode; side?: 'chat' | 'audit' }) {
  const { L } = useL();
  return (
    <div className="auth">
      <div className="hero">
        <AuthSide side={side} />
        <Link to="/" style={{ textDecoration: 'none' }}><Logo light /></Link>
        <div className="auth-copy">
          <h1>{L('Know what the records say before you pay the advance.', 'முன்பணம் கொடுக்கும் முன் பதிவுகள் என்ன சொல்கின்றன என்று அறியுங்கள்.')}</h1>
          <p>{L('Upload your documents, we cross-check them with each other and with map data, and show every finding with its evidence.', 'ஆவணங்களை பதிவேற்றுங்கள்; அவற்றை ஒன்றோடொன்றும் வரைபட தரவுடனும் ஒப்பிட்டு, ஒவ்வொரு முடிவையும் ஆதாரத்துடன் காட்டுகிறோம்.')}</p>
        </div>
        <span className="sm" style={{ color: '#6F9885' }}>{L('A due-diligence aid, not legal advice.', 'இது ஒரு சரிபார்ப்பு உதவி; சட்ட ஆலோசனை அல்ல.')}</span>
      </div>
      <div className="fm"><div style={{ textAlign: 'right', marginBottom: 20 }}><LangSwitch /></div>{children}</div>
    </div>
  );
}

function GoogleButton({ agree, onNeed }: { agree: boolean; onNeed: () => void }) {
  const { L } = useL(), [er, setEr] = useState('');
  if (import.meta.env.VITE_GOOGLE_LOGIN !== 'true') return null; // shown only after Google is enabled in Supabase
  const go = async () => { if (!agree) return onNeed(); setEr(''); if (await api.signInWithGoogle()) setEr(L('Could not start Google sign-in. Try again.', 'Google உள்நுழைவை தொடங்க முடியவில்லை.')); };
  return <div style={{ margin: '14px 0 4px' }}>
    <div className="mu sm" style={{ textAlign: 'center', marginBottom: 8 }}>{L('or', 'அல்லது')}</div>
    <button className="btn o" style={{ width: '100%', padding: 12 }} onClick={go}>
      <svg width="18" height="18" viewBox="0 0 48 48" style={{ marginRight: 8, verticalAlign: -3 }} aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
      {L('Continue with Google', 'Google மூலம் தொடர்க')}
    </button>
    <div className="err" role="alert">{er}</div>
  </div>;
}
const ERR_NET = ['Something went wrong. Check your internet and try again.', 'ஏதோ தவறு நடந்தது. இணையத்தை சரிபார்த்து மீண்டும் முயற்சிக்கவும்.'] as const;

export function Login() {
  const { L } = useL(), nav = useNavigate(), [e, setE] = useState(''), [p, setP] = useState(''), [er, setEr] = useState(''), [busy, setBusy] = useState(false), [gOk, setGOk] = useState(false);
  const go = async () => {
    if (busy) return; setBusy(true); setEr('');
    const r = await api.login(e, p); setBusy(false);
    if (!r) return nav('/');
    setEr({
      BAD_CREDENTIALS: L('Wrong email or password.', 'மின்னஞ்சல் அல்லது கடவுச்சொல் தவறு.'),
      NOT_CONFIRMED: L('Please verify your email first. Use Register again to get a new code.', 'முதலில் மின்னஞ்சலை சரிபார்க்கவும்.'),
      SUSPENDED: L('This account is suspended. Contact support.', 'இந்த கணக்கு இடைநிறுத்தப்பட்டுள்ளது.'),
      RATE: L('Too many attempts. Wait a minute and try again.', 'அதிக முயற்சிகள். ஒரு நிமிடம் காத்திருக்கவும்.'),
    }[r] ?? L(...ERR_NET));
  };
  return <Frame>
    <h1 style={{ fontSize: 32 }}>{L('Log in', 'உள்நுழைக')}</h1><p className="mu">{L('Welcome back.', 'மீண்டும் வருக.')}</p>
    <div className="fld"><label className="f">{L('Email', 'மின்னஞ்சல்')}</label><input className="in" value={e} onChange={x => setE(x.target.value)} type="email" autoComplete="username" /></div>
    <div className="fld"><label className="f">{L('Password', 'கடவுச்சொல்')}</label><input className="in" type="password" value={p} onChange={x => setP(x.target.value)} onKeyDown={x => x.key === 'Enter' && go()} autoComplete="current-password" /></div>
    <div className="err" role="alert">{er}</div>
    <button className="btn gr" style={{ width: '100%', padding: 13 }} disabled={busy} onClick={go}>{busy ? '…' : L('Log in', 'உள்நுழைக')}</button>
    <GoogleButton agree={gOk} onNeed={() => setEr(L('Tick the consent box below to continue with Google.', 'Google மூலம் தொடர கீழே ஒப்புதலை தேர்வு செய்யவும்.'))} />
    <label className="row" style={{ gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}><input type="checkbox" checked={gOk} onChange={x => setGOk(x.target.checked)} style={{ marginTop: 3 }} /><span className="sm mu">{L('For new Google accounts: I agree to the ', 'புதிய Google கணக்கிற்கு: நான் ஒப்புக்கொள்கிறேன் ')}<Link to="/legal/privacy" target="_blank">{L('Privacy Notice', 'தனியுரிமை அறிவிப்பு')}</Link>.</span></label>
    <p className="mu" style={{ textAlign: 'center' }}><Link to="/forgot">{L('Forgot password?', 'கடவுச்சொல் மறந்துவிட்டதா?')}</Link></p>
    <p className="mu" style={{ textAlign: 'center' }}>{L('New here?', 'புதியவரா?')} <Link to="/register">{L('Create an account', 'கணக்கை உருவாக்கு')}</Link></p>
  </Frame>;
}

export function Register() {
  const { L } = useL(), nav = useNavigate(), [f, setF] = useState({ name: '', email: '', mobile: '', pw: '' }), [agree, setAgree] = useState(false), [er, setEr] = useState(''), [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (x: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: x.target.value });
  const go = async () => {
    if (busy) return;
    if (f.name.trim().length < 2) return setEr(L('Enter your name.', 'பெயரை உள்ளிடுக.'));
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return setEr(L('Enter a valid email.', 'சரியான மின்னஞ்சல் தேவை.'));
    if (!/^[6-9]\d{9}$/.test(f.mobile)) return setEr(L('Enter a valid 10-digit mobile number.', 'சரியான 10 இலக்க மொபைல் எண் தேவை.'));
    if (f.pw.length < 8) return setEr(L('Password must be at least 8 characters.', 'கடவுச்சொல் குறைந்தது 8 எழுத்துகள்.'));
    if (!agree) return setEr(L('Please tick the consent box to continue.', 'தொடர ஒப்புதல் பெட்டியை தேர்வு செய்யவும்.'));
    setBusy(true); setEr('');
    const r = await api.startRegister({ name: f.name.trim(), email: f.email.trim(), mobile: f.mobile, pw: f.pw }); setBusy(false);
    if (r === 'EXISTS') return setEr(L('This email is already registered. Log in instead.', 'இந்த மின்னஞ்சல் ஏற்கனவே பதிவு செய்யப்பட்டுள்ளது.'));
    if (r === 'RATE') return setEr(L('Too many emails sent. Wait a few minutes and try again.', 'அதிக மின்னஞ்சல்கள். சில நிமிடங்கள் காத்திருக்கவும்.'));
    if (r === 'SIGNED_IN') return nav('/');
    if (r) return setEr(L(...ERR_NET));
    nav('/otp');
  };
  return <Frame side="audit">
    <h2>{L('Create your account', 'கணக்கை உருவாக்கு')}</h2><p className="mu">{L('Your first audit is free. We verify your email with a 6-digit code.', 'முதல் தணிக்கை இலவசம். மின்னஞ்சலை 6 இலக்க குறியீட்டால் சரிபார்ப்போம்.')}</p>
    {([['name', L('Full name', 'முழு பெயர்'), 'text'], ['email', L('Email', 'மின்னஞ்சல்'), 'email'], ['mobile', L('Mobile number', 'மொபைல் எண்'), 'tel'], ['pw', L('Password (8+ characters)', 'கடவுச்சொல் (8+ எழுத்து)'), 'password']] as const).map(([k, l, t]) =>
      <div className="fld" key={k}><label className="f">{l}</label><input className="in" type={t} value={f[k]} onChange={set(k)} maxLength={k === 'mobile' ? 10 : 80} inputMode={k === 'mobile' ? 'numeric' : undefined} autoComplete={k === 'pw' ? 'new-password' : undefined} /></div>)}
    <label className="row" style={{ gap: 10, alignItems: 'flex-start', margin: '6px 0 10px', cursor: 'pointer' }}>
      <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} style={{ marginTop: 4 }} />
      <span className="sm">{L('I agree that LandAudit may process my name, email, mobile, the property details, documents and location I provide, only to run the audits I request. I have read the ', 'நான் வழங்கும் பெயர், மின்னஞ்சல், மொபைல், சொத்து விவரங்கள், ஆவணங்கள், இருப்பிடம் ஆகியவற்றை நான் கோரும் தணிக்கைகளுக்காக மட்டும் LandAudit பயன்படுத்த ஒப்புக்கொள்கிறேன். ')}<Link to="/legal/privacy" target="_blank">{L('Privacy Notice', 'தனியுரிமை அறிவிப்பு')}</Link>{L('. I can withdraw consent any time by deleting my account in Settings.', '. அமைப்புகளில் கணக்கை நீக்கி எப்போது வேண்டுமானாலும் ஒப்புதலை திரும்பப் பெறலாம்.')}</span>
    </label>
    <div className="err" role="alert">{er}</div>
    <button className="btn gr" style={{ width: '100%', padding: 13 }} disabled={busy} onClick={go}>{busy ? '…' : L('Send code', 'குறியீடு அனுப்பு')}</button>
    <GoogleButton agree={agree} onNeed={() => setEr(L('Please tick the consent box to continue.', 'தொடர ஒப்புதல் பெட்டியை தேர்வு செய்யவும்.'))} />
    <p className="mu" style={{ textAlign: 'center' }}>{L('Have an account?', 'கணக்கு உள்ளதா?')} <Link to="/login">{L('Log in', 'உள்நுழைக')}</Link></p>
  </Frame>;
}

export function Otp() {
  const { L } = useL(), nav = useNavigate(), { pending } = useStore(), [d, setD] = useState(['', '', '', '', '', '']), [er, setEr] = useState(''), [sec, setSec] = useState(30), [att, setAtt] = useState(0), [busy, setBusy] = useState(false), refs = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => { if (!pending) nav('/register'); refs.current[0]?.focus(); }, []); // eslint-disable-line
  useEffect(() => { if (sec <= 0) return; const t = setTimeout(() => setSec(sec - 1), 1000); return () => clearTimeout(t); }, [sec]);
  const put = (i: number, v: string) => { const x = v.replace(/\D/g, '').slice(-1); const n = [...d]; n[i] = x; setD(n); if (x && i < 5) refs.current[i + 1]?.focus(); };
  const go = async () => {
    const code = d.join('');
    if (code.length < 6) return setEr(L('Enter all 6 digits.', '6 இலக்கங்களையும் உள்ளிடுக.'));
    if (att >= 5) return setEr(L('Too many attempts. Request a new code.', 'அதிக முயற்சிகள். புதிய குறியீடு கேளுங்கள்.'));
    setAtt(att + 1); setBusy(true); const ok = await api.verifyOtp(code); setBusy(false);
    if (ok) nav('/'); else setEr(L('Wrong or expired code.', 'தவறான அல்லது காலாவதியான குறியீடு.'));
  };
  const resend = async () => { const ok = await api.resendOtp(); setSec(30); setAtt(0); setEr(ok ? L('A new code has been sent.', 'புதிய குறியீடு அனுப்பப்பட்டது.') : L('Could not send. Try again shortly.', 'அனுப்ப முடியவில்லை.')); };
  return <Frame side="audit">
    <h2>{L('Enter the code', 'குறியீட்டை உள்ளிடுக')}</h2>
    <p className="mu">{L('We sent a confirmation email to ', 'உறுதிப்படுத்தும் மின்னஞ்சல் அனுப்பப்பட்டது: ')}<b>{pending?.email}</b>. {L('Check spam too. If the email has a confirmation link instead of a code, just click the link; you will be signed in.', 'ஸ்பாம் கோப்புறையையும் பாருங்கள். மின்னஞ்சலில் குறியீட்டுக்கு பதிலாக இணைப்பு இருந்தால் அதை கிளிக் செய்யவும்.')}</p>
    <div className="otp" onPaste={e => { const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6); setD([...t.padEnd(6, ' ').split('').map(c => c.trim())]); e.preventDefault(); }}>
      {d.map((v, i) => <input key={i} ref={el => { refs.current[i] = el; }} value={v} inputMode="numeric" aria-label={`Digit ${i + 1}`} onChange={e => put(i, e.target.value)} onKeyDown={e => { if (e.key === 'Backspace' && !v && i) refs.current[i - 1]?.focus(); if (e.key === 'Enter') go(); }} />)}
    </div>
    <div className="err" role="alert">{er}</div>
    <button className="btn gr" style={{ width: '100%', padding: 13 }} disabled={busy} onClick={go}>{busy ? '…' : L('Verify and continue', 'சரிபார்த்து தொடர்க')}</button>
    <button className="btn o" style={{ width: '100%', marginTop: 10 }} disabled={sec > 0} onClick={resend}>{sec > 0 ? L(`Resend in ${sec}s`, `${sec} வி-ல் மீண்டும் அனுப்பு`) : L('Resend code', 'மீண்டும் அனுப்பு')}</button>
    <p style={{ textAlign: 'center' }}><Link to="/register">{L('Use a different email', 'வேறு மின்னஞ்சல்')}</Link></p>
  </Frame>;
}

export function Forgot() {
  const { L } = useL(), [e, setE] = useState(''), [er, setEr] = useState(''), [sent, setSent] = useState(false), [busy, setBusy] = useState(false);
  const go = async () => {
    if (!/^\S+@\S+\.\S+$/.test(e)) return setEr(L('Enter a valid email.', 'சரியான மின்னஞ்சல் தேவை.'));
    setBusy(true); const ok = await api.forgotPassword(e); setBusy(false);
    if (ok) setSent(true); else setEr(L('Could not send the email. Wait a few minutes and try again.', 'மின்னஞ்சல் அனுப்ப முடியவில்லை.'));
  };
  return <Frame>
    <h2>{L('Reset your password', 'கடவுச்சொல்லை மீட்டமை')}</h2>
    {sent ? <div className="notice">{L('If this email has an account, a reset link is on its way. Open it on this device.', 'இந்த மின்னஞ்சலுக்கு கணக்கு இருந்தால், மீட்டமைப்பு இணைப்பு அனுப்பப்படும்.')}</div> : <>
      <p className="mu">{L('Enter your email and we will send a reset link.', 'மின்னஞ்சலை உள்ளிடுங்கள்; மீட்டமைப்பு இணைப்பு அனுப்புவோம்.')}</p>
      <div className="fld"><label className="f">{L('Email', 'மின்னஞ்சல்')}</label><input className="in" type="email" value={e} onChange={x => setE(x.target.value)} onKeyDown={x => x.key === 'Enter' && go()} /></div>
      <div className="err" role="alert">{er}</div>
      <button className="btn gr" style={{ width: '100%', padding: 13 }} disabled={busy} onClick={go}>{busy ? '…' : L('Send reset link', 'இணைப்பை அனுப்பு')}</button></>}
    <p style={{ textAlign: 'center' }}><Link to="/login">{L('Back to log in', 'உள்நுழைவுக்கு திரும்பு')}</Link></p>
  </Frame>;
}

/** Shown when the user opens the reset link from their email. */
export function ResetPassword() {
  const { L } = useL(), [p, setP] = useState(''), [er, setEr] = useState(''), [busy, setBusy] = useState(false);
  const go = async () => {
    if (p.length < 8) return setEr(L('Password must be at least 8 characters.', 'கடவுச்சொல் குறைந்தது 8 எழுத்துகள்.'));
    setBusy(true); const ok = await api.updatePassword(p); setBusy(false);
    if (!ok) setEr(L('Could not update. The link may have expired; request a new one.', 'புதுப்பிக்க முடியவில்லை. இணைப்பு காலாவதியாகி இருக்கலாம்.'));
  };
  return <Frame>
    <h2>{L('Choose a new password', 'புதிய கடவுச்சொல்')}</h2>
    <div className="fld"><label className="f">{L('New password (8+ characters)', 'புதிய கடவுச்சொல் (8+ எழுத்து)')}</label><input className="in" type="password" value={p} onChange={x => setP(x.target.value)} onKeyDown={x => x.key === 'Enter' && go()} autoComplete="new-password" /></div>
    <div className="err" role="alert">{er}</div>
    <button className="btn gr" style={{ width: '100%', padding: 13 }} disabled={busy} onClick={go}>{busy ? '…' : L('Save password', 'சேமி')}</button>
  </Frame>;
}
