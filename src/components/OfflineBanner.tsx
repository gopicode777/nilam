import { useEffect, useState } from 'react';
import { useL } from '../i18n';

export default function OfflineBanner() {
  const { L } = useL(), [online, setOnline] = useState(navigator.onLine);
  useEffect(() => { const on = () => setOnline(true), off = () => setOnline(false); window.addEventListener('online', on); window.addEventListener('offline', off); return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); }; }, []);
  if (online) return null;
  return <div className="offline" role="status">{L('You are offline. You can look around, but saving, uploads and the map need internet.', 'இணைய இணைப்பு இல்லை. பார்க்கலாம்; சேமிப்பு, பதிவேற்றம், வரைபடத்துக்கு இணையம் வேண்டும்.')}</div>;
}
