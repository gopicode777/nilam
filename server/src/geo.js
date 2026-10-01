// Real geodata with no API key: Nominatim (search) + Overpass (nearby features), both OpenStreetMap.
// Swap to Google Places / Geocoding later by replacing these two functions only.
const UA = 'NilamLandAudit/0.1 (contact: set-your-email@example.com)';
const cache = new Map();
const memo = async (k, fn) => { if (cache.has(k)) return cache.get(k); const v = await fn(); cache.set(k, v); if (cache.size > 500) cache.delete(cache.keys().next().value); return v; };

export const searchPlace = (q) => memo('s:' + q, async () => {
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=in&q=${encodeURIComponent(q)}`, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`Geocoder returned ${r.status}`);
  return (await r.json()).map((p) => ({ name: p.display_name, lat: +p.lat, lng: +p.lon }));
});

const haversine = (a, b, c, d) => {
  const R = 6371000, t = (x) => (x * Math.PI) / 180, dl = t(c - a), dg = t(d - b);
  const h = Math.sin(dl / 2) ** 2 + Math.cos(t(a)) * Math.cos(t(c)) * Math.sin(dg / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
};

export async function nearby(lat, lng) {
  const q = `[out:json][timeout:25];(
    nwr(around:3000,${lat},${lng})[amenity~"^(hospital|clinic|school|college|bus_station)$"];
    node(around:1500,${lat},${lng})[highway=bus_stop];
    nwr(around:1000,${lat},${lng})[natural=water];
    way(around:1000,${lat},${lng})[waterway~"^(river|stream|canal)$"];
  );out center 80;`;
  const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) });
  if (!r.ok) throw new Error(`Overpass returned ${r.status}`);
  const { elements } = await r.json();
  const items = elements.map((e) => {
    const la = e.lat ?? e.center?.lat, lo = e.lon ?? e.center?.lon, t = e.tags || {};
    if (la == null) return null;
    const kind = t.natural === 'water' || t.waterway ? 'water' : t.amenity === 'hospital' || t.amenity === 'clinic' ? 'health' : t.amenity === 'school' || t.amenity === 'college' ? 'education' : 'transport';
    return { kind, name: t.name || t['name:en'] || t.amenity || t.waterway || t.natural, lat: la, lng: lo, distance: haversine(lat, lng, la, lo) };
  }).filter(Boolean).sort((a, b) => a.distance - b.distance);
  return { fetched_at: new Date().toISOString(), source: 'OpenStreetMap (Overpass)', items };
}
