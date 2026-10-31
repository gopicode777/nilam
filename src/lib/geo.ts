type Pt = [number, number]; // [lat, lng]

/** Area of a small polygon (a plot) in square feet, using a local flat projection. Accurate to well under 1% for plot-sized shapes. */
export function polyAreaSqft(pts: Pt[]) {
  if (pts.length < 3) return 0;
  const lat0 = pts.reduce((a, p) => a + p[0], 0) / pts.length, lng0 = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180), ky = 110540;
  const xy = pts.map(p => [(p[1] - lng0) * kx, (p[0] - lat0) * ky]); let a = 0;
  xy.forEach(([x1, y1], i) => { const [x2, y2] = xy[(i + 1) % xy.length]; a += x1 * y2 - x2 * y1; });
  return (Math.abs(a) / 2) * 10.7639;
}
/** Tamil Nadu land units: 1 cent = 435.6 sq ft, 1 ground = 2400 sq ft, 1 acre = 43560 sq ft. */
export const fmtArea = (sqft: number) => `${Math.round(sqft).toLocaleString('en-IN')} sq ft · ${(sqft / 435.6).toFixed(2)} cents · ${(sqft / 2400).toFixed(2)} grounds · ${(sqft / 43560).toFixed(3)} acres`;

