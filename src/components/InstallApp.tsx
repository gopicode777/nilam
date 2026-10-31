import { useEffect, useState } from 'react';
import { useL } from '../i18n';

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<unknown> }
/** "Install app" button. Browsers only offer it when the app is installable and not already installed. */
export default function InstallApp() {
  const { L } = useL(), [ev, setEv] = useState<InstallEvent | null>(null);
  useEffect(() => {
    const f = (e: Event) => { e.preventDefault(); setEv(e as InstallEvent); }, done = () => setEv(null);
    window.addEventListener('beforeinstallprompt', f); window.addEventListener('appinstalled', done);
    return () => { window.removeEventListener('beforeinstallprompt', f); window.removeEventListener('appinstalled', done); };
  }, []);
  if (!ev) return null;
  return <button className="nav" onClick={async () => { await ev.prompt(); await ev.userChoice; setEv(null); }}>⬇ {L('Install app', 'செயலியை நிறுவு')}</button>;
}
