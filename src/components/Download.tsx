import { useState } from 'react';
import { useL } from '../i18n';
import { ALL_OPT, ReportOpt } from './ReportDoc';
import { downloadCsv, downloadReport } from '../lib/pdf';
import type { Case } from '../types';

/** Download module: language, sections, PDF and CSV. */
export default function DownloadPanel({ c }: { c: Case }) {
  const { L, lang: app } = useL(), [lang, setLang] = useState<'en' | 'ta'>(app), [opt, setOpt] = useState<ReportOpt>(ALL_OPT), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const names: [keyof ReportOpt, string][] = [['highlights', L('Key highlights and map', 'முக்கிய அம்சங்கள் & வரைபடம்')], ['findings', L('Findings and evidence', 'முடிவுகள் & ஆதாரம்')], ['chain', L('Ownership chain', 'உரிமை சங்கிலி')], ['location', L('Location and neighbourhood', 'இடம் & சுற்றுப்புறம்')], ['claims', L('Broker claims', 'தரகர் கூற்றுகள்')], ['documents', L('Documents and values', 'ஆவணங்கள் & மதிப்புகள்')], ['actions', L('Actions before payment', 'செய்ய வேண்டியவை')]];
  const go = async () => { setBusy(true); setErr(''); try { await downloadReport(c, lang, opt); } catch (e) { setErr(L('Could not create the PDF. Try again, or use Print on the Report tab.', 'PDF உருவாக்க முடியவில்லை. மீண்டும் முயலவும், அல்லது அறிக்கை பகுதியில் Print பயன்படுத்தவும்.')); console.error(e); } setBusy(false); };
  return <div className="panel"><div className="ph"><h3>{L('Download report', 'அறிக்கையை பதிவிறக்கு')}</h3><div className="sp" /><select className="in" style={{ width: 'auto', padding: '4px 8px' }} value={lang} onChange={e => setLang(e.target.value as 'en' | 'ta')} aria-label="Report language"><option value="en">English</option><option value="ta">தமிழ்</option></select></div>
    <div className="pad"><div className="g c2" style={{ gap: '4px 20px', marginBottom: 14 }}>{names.map(([k, l]) => <label key={k} className="row" style={{ cursor: 'pointer', gap: 8 }}><input type="checkbox" checked={opt[k]} onChange={e => setOpt({ ...opt, [k]: e.target.checked })} />{l}</label>)}</div>
      <div className="row wrap"><button className="btn" onClick={go} disabled={busy}>{busy ? L('Preparing PDF…', 'PDF தயாராகிறது…') : L('Download PDF', 'PDF பதிவிறக்கு')}</button><button className="btn o" onClick={() => downloadCsv(c, lang)}>{L('Findings (CSV)', 'முடிவுகள் (CSV)')}</button></div>
      <div className="err" role="alert">{err}</div><div className="mu sm">{L('A4 PDF with score, status rows, highlights with map, findings, chain, claims, documents and actions. The map needs internet.', 'மதிப்பெண், நிலை, வரைபடத்துடன் அம்சங்கள், முடிவுகள், சங்கிலி, கூற்றுகள், ஆவணங்கள், நடவடிக்கைகளுடன் A4 PDF. வரைபடத்துக்கு இணையம் தேவை.')}</div></div></div>;
}
