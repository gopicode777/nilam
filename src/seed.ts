import type { Case, DocType, State, User } from './types';
import { analyze, makeDoc } from './engine';

const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 864e5).toISOString();
const U = (id: string, name: string, email: string, mobile: string, plan: User['plan'], credits: number, days: number, status: User['status'] = 'active'): User =>
  ({ id, name, email, mobile, role: 'user', plan, credits, joined: iso(days), status });

function mk(id: string, owner: string, p: Partial<Case>, docs: DocType[], audit: boolean, days: number): Case {
  const c: Case = { id, ownerId: owner, created: iso(days), district: 'Tiruvallur', taluk: 'Uthukottai', village: 'Periyapalayam', survey: '123/4A', extent: 2400, seller: 'Ravi Kumar', ptype: 'Residential plot', purpose: 'Buy and build', lat: 13.1439, lng: 79.9086, docs: [], claims: [], radius: 2000, ...p };
  c.docs = docs.map(t => ({ ...makeDoc(t, c, `${t}.pdf`, iso(days)), verified: audit }));
  if (audit) { c.audit = analyze(c); c.paid = true; }
  return c;
}

export function seed(): State {
  const admin: User = { id: 'u0', name: 'Admin', email: 'admin@landaudit.ai', mobile: '9000000000', role: 'admin', plan: 'business', credits: 0, joined: iso(120), status: 'active' };
  const users = [admin, U('u1', 'Ravi Kumar', 'ravi@example.com', '9840011111', 'pro', 4, 40), U('u2', 'Meenakshi S', 'meena@example.com', '9884022222', 'free', 1, 12),
    U('u3', 'Arun Prakash', 'arun@example.com', '9791033333', 'pro', 19, 33), U('u4', 'Fathima B', 'fathima@example.com', '9942044444', 'free', 0, 9),
    U('u5', 'Selvam Realty', 'selvam@realty.in', '9500055555', 'business', 21, 61), U('u6', 'Kavitha R', 'kavitha@example.com', '9677066666', 'free', 1, 3, 'suspended')];
  const cases = [
    mk('C-1001', 'u1', {}, ['parent', 'sale_deed', 'patta', 'ec', 'tax'], true, 6),
    mk('C-1002', 'u1', { district: 'Vellore', taluk: 'Katpadi', village: 'Viruthampet', survey: '45/2B', extent: 1800, seller: 'S. Lakshmi', lat: 12.9716, lng: 79.1587 }, ['sale_deed'], false, 2),
    mk('C-1003', 'u2', { district: 'Coimbatore', taluk: 'Sulur', village: 'Kangeyampalayam', survey: '210/1', extent: 4356, seller: 'Murugan P', lat: 11.0168, lng: 77.1256, purpose: 'Investment' }, ['parent', 'sale_deed', 'patta', 'ec', 'approval'], true, 9),
    mk('C-1004', 'u3', { district: 'Madurai', taluk: 'Thirumangalam', village: 'Kalligudi', survey: '77/3', extent: 6000, ptype: 'Agricultural', lat: 9.8233, lng: 77.9877, seller: 'A. Pandian' }, ['sale_deed', 'patta'], true, 20),
    mk('C-1005', 'u5', { district: 'Chennai', taluk: 'Ambattur', village: 'Korattur', survey: '12/9', extent: 1200, seller: 'Jayanthi M', lat: 13.1067, lng: 80.1859 }, ['sale_deed', 'patta', 'chitta', 'ec'], true, 14),
    mk('C-1006', 'u4', { district: 'Krishnagiri', taluk: 'Hosur', village: 'Bagalur', survey: '33/1', extent: 2178, seller: 'K. Ramesh', lat: 12.7409, lng: 77.8253 }, [], false, 1),
  ];
  // make one seeded case show a critical owner mismatch
  const c3 = cases[3]; const p = c3.docs.find(d => d.type === 'patta'); if (p) { p.fields.holder.v = 'Gopal Raj'; c3.audit = analyze(c3); }
  const logs = [
    { id: 'L1', at: iso(6), actor: 'Ravi Kumar', action: 'Created case', target: 'C-1001' }, { id: 'L2', at: iso(6), actor: 'Ravi Kumar', action: 'Ran audit', target: 'C-1001' },
    { id: 'L3', at: iso(3), actor: 'Kavitha R', action: 'Account suspended by admin', target: 'u6' }, { id: 'L4', at: iso(2), actor: 'Ravi Kumar', action: 'Uploaded 1 document', target: 'C-1002' },
  ];
  const payments = [{ id: 'P1', userId: 'u1', pack: 'Buyer pack', credits: 5, amount: 1999, at: iso(30) }, { id: 'P2', userId: 'u3', pack: 'Advisor pack', credits: 25, amount: 7499, at: iso(28) }, { id: 'P3', userId: 'u5', pack: 'Advisor pack', credits: 25, amount: 7499, at: iso(50) }];
  const reviews = [{ id: 'R1', caseId: 'C-1004', userId: 'u3', kind: 'advocate' as const, status: 'requested' as const, at: iso(1) }];
  return { users, cases, reviews, logs, payments, session: null, lang: 'en', theme: 'light' };
}
