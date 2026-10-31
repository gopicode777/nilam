import { describe, expect, it } from 'vitest';
import { fmtArea, polyAreaSqft } from '../lib/geo';

const square = (lat: number, lng: number, sideM: number): [number, number][] => { const dl = sideM / 110540, dn = sideM / (111320 * Math.cos((lat * Math.PI) / 180)); return [[lat, lng], [lat, lng + dn], [lat + dl, lng + dn], [lat + dl, lng]]; };
describe('plot area', () => {
  it('measures a 100 ft square as about 10,000 sq ft', () => { expect(Math.abs(polyAreaSqft(square(11.27, 77.67, 30.48)) - 10000)).toBeLessThan(100); });
  it('measures one ground as 2,400 sq ft', () => { expect(Math.abs(polyAreaSqft(square(13.08, 80.27, Math.sqrt(2400 * 0.092903))) - 2400)).toBeLessThan(30); });
  it('is 0 for fewer than 3 points', () => { expect(polyAreaSqft([[11, 77], [11.001, 77]])).toBe(0); });
  it('does not depend on the order the corners are tapped', () => { const p = square(10.9, 78.4, 40); expect(Math.round(polyAreaSqft(p))).toBe(Math.round(polyAreaSqft([...p].reverse()))); });
  it('shows Tamil Nadu units', () => { const t = fmtArea(2400); expect(t).toContain('2,400 sq ft'); expect(t).toContain('5.51 cents'); expect(t).toContain('1.00 grounds'); });
});
