import { useState } from 'react';
import { useL } from '../i18n';
import { useStore } from '../store';
import MapView from '../components/MapView';
import MapChat from '../components/MapChat';
import type { MapPlace } from '../types';

/** Standalone map + AI chat: drop a pin anywhere and ask about what is around it. */
export default function MapAssistant() {
  const { L } = useL(), s = useStore(), first = s.cases.find(c => c.ownerId === s.session);
  const [pos, setPos] = useState<[number, number]>([first?.lat ?? 13.0827, first?.lng ?? 80.2707]);
  const [places, setPlaces] = useState<MapPlace[]>([]), [active, setActive] = useState<number | undefined>();
  return <div>
    <h1 style={{ marginBottom: 4 }}>{L('Map assistant', 'வரைபட உதவியாளர்')}</h1>
    <p className="mu" style={{ marginTop: 0 }}>{L('Drop a pin on any plot or area, then ask about hospitals, PG hostels, schools, bus stops and more around it.', 'எந்த நிலம் / பகுதியிலும் பின்னை வைத்து, சுற்றியுள்ள மருத்துவமனைகள், PG விடுதிகள், பள்ளிகள், பேருந்து நிறுத்தங்கள் பற்றி கேளுங்கள்.')}</p>
    <div className="mapchat-grid">
      <div className="panel pad"><MapView lat={pos[0]} lng={pos[1]} sqft={0} places={places} activePlace={active} onPick={(la, lo) => { setPos([la, lo]); setPlaces([]); setActive(undefined); }} height={560} /></div>
      <MapChat lat={pos[0]} lng={pos[1]} height={560} onPlaces={p => { setPlaces(p); setActive(undefined); }} onSelect={setActive} />
    </div>
  </div>;
}
