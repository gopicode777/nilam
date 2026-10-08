import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { NearbyItem } from '../types';

interface Props { lat: number; lng: number; sqft: number; radius?: number; nearby?: Record<string, NearbyItem[]>; onPick?: (lat: number, lng: number) => void; height?: number }
const pin = L.divIcon({ className: '', html: '<div class="pin"></div>', iconSize: [22, 22], iconAnchor: [11, 22] });
const dot = L.divIcon({ className: '', html: '<div class="am"></div>', iconSize: [12, 12], iconAnchor: [6, 6] });

export default function MapView({ lat, lng, sqft, radius, nearby, onPick, height = 420 }: Props) {
  const el = useRef<HTMLDivElement>(null), map = useRef<L.Map>(), layer = useRef<L.LayerGroup>(), pick = useRef(onPick);
  pick.current = onPick;
  useEffect(() => {
    const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' });
    const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imagery © Esri' });
    const m = L.map(el.current!, { layers: [osm] }).setView([lat, lng], 15);
    L.control.layers({ Map: osm, Satellite: sat }).addTo(m);
    m.on('click', e => pick.current?.(e.latlng.lat, e.latlng.lng));
    layer.current = L.layerGroup().addTo(m); map.current = m;
    return () => { m.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const m = map.current!, g = layer.current!; g.clearLayers();
    const side = Math.sqrt(sqft * 0.092903) / 2, dl = side / 111320, dn = side / (111320 * Math.cos((lat * Math.PI) / 180));
    L.rectangle([[lat - dl, lng - dn], [lat + dl, lng + dn]], { color: '#2559D8', weight: 2, fillOpacity: 0.3 }).addTo(g);
    L.marker([lat, lng], { icon: pin }).addTo(g);
    if (radius) { const c = L.circle([lat, lng], { radius, color: '#16A06A', weight: 1.5, fillOpacity: 0.04, dashArray: '5 5' }).addTo(g); m.fitBounds(c.getBounds(), { maxZoom: 16 }); } else m.setView([lat, lng], m.getZoom());
    Object.entries(nearby ?? {}).forEach(([k, list]) => list.forEach(i => L.marker([i.lat, i.lng], { icon: dot }).bindPopup(`<b>${i.name}</b><br>${k.replace('_', ' ')} · ${i.km.toFixed(1)} km`).addTo(g)));
  }, [lat, lng, sqft, radius, nearby]);
  return <div ref={el} className="map" style={{ height }} />;
}
