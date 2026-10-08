import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useL } from '../i18n';
import MapView from '../components/MapView';
import * as api from '../api';

const DISTRICTS = ['Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore', 'Dharmapuri', 'Dindigul', 'Erode', 'Kancheepuram', 'Krishnagiri', 'Madurai', 'Nagapattinam', 'Namakkal', 'Salem', 'Thanjavur', 'Tiruvallur', 'Tiruvannamalai', 'Tirunelveli', 'Tirupattur', 'Trichy', 'Vellore', 'Villupuram'];

export default function NewCase() {
  const { L } = useL(), nav = useNavigate(), [f, setF] = useState({ district: 'Tiruvallur', taluk: '', village: '', survey: '', extent: 2400, seller: '', ptype: 'Residential plot', purpose: 'Buy and build', lat: 13.1439, lng: 79.9086 }), [er, setEr] = useState('');
  const up = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(x => ({ ...x, [k]: v }));
  const go = () => {
    if (!f.survey.trim()) return setEr(L('Enter the survey number.', 'சர்வே எண்ணை உள்ளிடுக.'));
    if (!f.seller.trim()) return setEr(L('Enter the seller name.', 'விற்பவர் பெயரை உள்ளிடுக.'));
    if (!(f.extent > 0)) return setEr(L('Enter the extent in sq.ft.', 'பரப்பை ச.அடியில் உள்ளிடுக.'));
    nav(`/cases/${api.createCase(f)}/documents`);
  };
  const T = (k: 'taluk' | 'village' | 'survey' | 'seller', label: string, ph = '') => <div className="fld"><label className="f">{label}</label><input className="in" placeholder={ph} value={f[k]} onChange={e => up(k, e.target.value)} /></div>;
  return <div className="pg">
    <div className="pg-h"><div><h1>{L('Add property', 'நிலம் சேர்க்க')}</h1><div className="mu">{L('This opens a case. Next you add documents, then we run the audit.', 'இது ஒரு வழக்கை திறக்கும். அடுத்து ஆவணங்கள், பிறகு தணிக்கை.')}</div></div></div>
    <div className="g c2">
      <div className="panel pad">
        <h3 style={{ marginBottom: 14 }}>{L('Property identity', 'நில அடையாளம்')}</h3>
        <div className="fld"><label className="f">{L('District', 'மாவட்டம்')}</label><select className="in" value={f.district} onChange={e => up('district', e.target.value)}>{DISTRICTS.map(d => <option key={d}>{d}</option>)}</select></div>
        <div className="g c2" style={{ gap: 12 }}>{T('taluk', L('Taluk', 'வட்டம்'))}{T('village', L('Village', 'கிராமம்'))}</div>
        <div className="g c2" style={{ gap: 12 }}>{T('survey', L('Survey number', 'சர்வே எண்'), '123/4A')}<div className="fld"><label className="f">{L('Extent (sq.ft)', 'பரப்பு (ச.அடி)')}</label><input className="in" type="number" value={f.extent} onChange={e => up('extent', +e.target.value)} /></div></div>
        {T('seller', L('Seller name (as the seller states)', 'விற்பவர் பெயர்'))}
        <div className="g c2" style={{ gap: 12 }}>
          <div className="fld"><label className="f">{L('Property type', 'நில வகை')}</label><select className="in" value={f.ptype} onChange={e => up('ptype', e.target.value)}>{['Residential plot', 'Agricultural', 'Commercial', 'Flat / apartment'].map(x => <option key={x}>{x}</option>)}</select></div>
          <div className="fld"><label className="f">{L('Your purpose', 'நோக்கம்')}</label><select className="in" value={f.purpose} onChange={e => up('purpose', e.target.value)}>{['Buy and build', 'Investment', 'Farming', 'Loan collateral'].map(x => <option key={x}>{x}</option>)}</select></div>
        </div>
        <div className="err" role="alert">{er}</div>
        <button className="btn" onClick={go}>{L('Create case and add documents', 'வழக்கை உருவாக்கி ஆவணங்களை சேர்')}</button>
      </div>
      <div className="panel pad"><h3 style={{ marginBottom: 4 }}>{L('Drop the pin', 'பின் வைக்கவும்')}</h3><div className="mu sm" style={{ marginBottom: 10 }}>{L('Click the map on the plot. ', 'வரைபடத்தில் நிலத்தின் மீது கிளிக் செய்க. ')}{f.lat.toFixed(5)}, {f.lng.toFixed(5)}</div>
        <MapView lat={f.lat} lng={f.lng} sqft={f.extent || 1200} onPick={(la, lo) => setF(x => ({ ...x, lat: la, lng: lo }))} height={460} /></div>
    </div>
  </div>;
}
