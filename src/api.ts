/**
 * Frontend-only "API". Every function here is the seam where a real backend call goes later
 * (REST/SSE). Pages never touch the store directly for writes, so swapping this file is enough.
 */
import { analyze, makeDoc, NEARBY_CATS, detectType, DEFAULT_CFG } from './engine';
import { get, set } from './store';
import type { Case, Cfg, Claim, Doc, DocType, Log, NearbyItem, Prefs, Review, User } from './types';

const now = () => new Date().toISOString();
const id = (p: string) => p + Math.random().toString(36).slice(2, 7);
export const me = (): User | undefined => get().users.find(u => u.id === get().session);
const log = (s: ReturnType<typeof get>, action: string, target?: string): Log[] => [{ id: id('L'), at: now(), actor: s.users.find(u => u.id === s.session)?.name ?? 'Visitor', action, target }, ...s.logs].slice(0, 200);

export function login(email: string, password: string): string | null {
  const u = get().users.find(x => x.email.toLowerCase() === email.trim().toLowerCase());
  if (!u) return 'NO_ACCOUNT';
  if (password.length < 8) return 'BAD_PASSWORD';
  if (u.status === 'suspended') return 'SUSPENDED';
  set(s => ({ ...s, session: u.id, logs: [{ id: id('L'), at: now(), actor: u.name, action: 'Logged in' }, ...s.logs] }));
  return null;
}
export function startRegister(p: { name: string; email: string; mobile: string }): string | null {
  if (get().users.some(u => u.email.toLowerCase() === p.email.toLowerCase())) return 'EXISTS';
  set(s => ({ ...s, pending: p })); return null;
}
export function verifyOtp(code: string): boolean {
  const p = get().pending; if (!p || !/^\d{6}$/.test(code)) return false;
  const u: User = { id: id('u'), name: p.name, email: p.email, mobile: p.mobile, role: 'user', plan: 'free', credits: 1, joined: now(), status: 'active' };
  set(s => ({ ...s, users: [...s.users, u], session: u.id, pending: undefined, logs: [{ id: id('L'), at: now(), actor: u.name, action: 'Registered' }, ...s.logs] }));
  return true;
}
export const logout = () => set(s => ({ ...s, session: null }));
export const setLang = (lang: 'en' | 'ta') => set(s => ({ ...s, lang }));
export const toggleTheme = () => set(s => ({ ...s, theme: s.theme === 'light' ? 'dark' : 'light' }));

export function createCase(p: Partial<Case>): string {
  const cid = 'C-' + (1000 + get().cases.length + 1 + Math.floor(Math.random() * 90));
  const c: Case = { id: cid, ownerId: get().session!, created: now(), district: 'Tiruvallur', taluk: '', village: '', survey: '', extent: 2400, seller: '', ptype: 'Residential plot', purpose: 'Buy and build', lat: 13.1439, lng: 79.9086, docs: [], claims: [], radius: 2000, ...p };
  set(s => ({ ...s, cases: [c, ...s.cases], logs: log(s, 'Created case', cid) })); return cid;
}
export const patchCase = (cid: string, fn: (c: Case) => Case, action?: string) =>
  set(s => ({ ...s, cases: s.cases.map(c => (c.id === cid ? fn(c) : c)), logs: action ? log(s, action, cid) : s.logs }));

export function addFiles(cid: string, names: string[], forceType?: DocType) {
  patchCase(cid, c => ({ ...c, audit: c.audit, docs: [...c.docs, ...names.map(n => makeDoc(forceType ?? detectType(n), c, n, now()))] }), `Uploaded ${names.length} document(s)`);
}
export const addSampleDocs = (cid: string) => addFiles(cid, ['sale-deed.pdf', 'patta.pdf', 'ec.pdf']);
export const updateField = (cid: string, did: string, key: string, v: string) =>
  patchCase(cid, c => ({ ...c, docs: c.docs.map(d => d.id === did ? { ...d, verified: false, fields: { ...d.fields, [key]: { ...d.fields[key], v, conf: 100 } } } : d) }));
export const confirmDoc = (cid: string, did: string, verified = true) => patchCase(cid, c => ({ ...c, docs: c.docs.map((d: Doc) => d.id === did ? { ...d, verified } : d) }), verified ? 'Confirmed document values' : undefined);
export const removeDoc = (cid: string, did: string) => patchCase(cid, c => ({ ...c, docs: c.docs.filter(d => d.id !== did) }), 'Removed document');
export const addClaim = (cid: string, cl: Omit<Claim, 'id'>) => patchCase(cid, c => ({ ...c, claims: [...c.claims, { ...cl, id: id('K') }] }), 'Added claim');
export const removeClaim = (cid: string, kid: string) => patchCase(cid, c => ({ ...c, claims: c.claims.filter(k => k.id !== kid) }));

const rad = (x: number) => (x * Math.PI) / 180;
export const km = (a: number, b: number, c: number, d: number) => { const h = Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };

/** Live OpenStreetMap data through the Overpass API (free, no key). */
export async function analyseLocation(cid: string, cats: string[], radius: number) {
  const c = get().cases.find(x => x.id === cid)!;
  const q = `[out:json][timeout:25];(${cats.map(k => `nwr(around:${radius},${c.lat},${c.lng})["${NEARBY_CATS[k].tag[0]}"="${NEARBY_CATS[k].tag[1]}"];`).join('')});out center 120;`;
  const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q) });
  if (!r.ok) throw new Error('Overpass ' + r.status);
  const j = (await r.json()) as { elements: { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[] };
  const out: Record<string, NearbyItem[]> = {};
  cats.forEach(k => {
    out[k] = j.elements.filter(e => e.tags?.[NEARBY_CATS[k].tag[0]] === NEARBY_CATS[k].tag[1]).map(e => {
      const la = e.lat ?? e.center!.lat, lo = e.lon ?? e.center!.lon;
      return { name: e.tags?.name ?? NEARBY_CATS[k].label.en.replace(/s$/, ''), km: km(c.lat, c.lng, la, lo), lat: la, lng: lo };
    }).sort((a, b) => a.km - b.km).slice(0, 8);
  });
  patchCase(cid, x => ({ ...x, radius, nearby: { ...(x.nearby ?? {}), ...out }, nearbyAt: now() }), 'Ran location analysis');
}

/** Returns an error code, or null when the audit ran. First audit per case uses one credit. */
export function runAudit(cid: string): string | null {
  const c = get().cases.find(x => x.id === cid)!, u = me()!;
  if (!c.paid && u.credits < 1) return 'NO_CREDITS';
  set(s => ({ ...s, users: c.paid ? s.users : s.users.map(x => x.id === u.id ? { ...x, credits: x.credits - 1 } : x), cases: s.cases.map(x => x.id === cid ? { ...x, paid: true, audit: analyze(x, s.config ?? DEFAULT_CFG) } : x), logs: log(s, 'Ran audit', cid) }));
  return null;
}
export function buyPack(name: string, credits: number, amount: number) {
  const uid = get().session!;
  set(s => ({ ...s, users: s.users.map(u => u.id === uid ? { ...u, credits: u.credits + credits, plan: u.plan === 'free' ? 'pro' : u.plan } : u), payments: [{ id: id('P'), userId: uid, pack: name, credits, amount, at: now() }, ...s.payments], logs: log(s, `Bought ${name}`) }));
}
export function requestReview(caseId: string, kind: Review['kind'], prefer?: string) {
  set(s => ({ ...s, reviews: [{ id: id('R'), caseId, userId: s.session!, kind, status: 'requested', at: now(), prefer }, ...s.reviews], logs: log(s, `Requested ${kind} review`, caseId) }));
}
// Admin
export const adminUser = (uid: string, fn: (u: User) => User, action: string) => set(s => ({ ...s, users: s.users.map(u => u.id === uid ? fn(u) : u), logs: log(s, action, uid) }));
export const adminReview = (rid: string, patch: Partial<Review>, action: string) => set(s => ({ ...s, reviews: s.reviews.map(r => r.id === rid ? { ...r, ...patch } : r), logs: log(s, action, rid) }));
export async function pingOverpass(): Promise<boolean> {
  try { const r = await fetch('https://overpass-api.de/api/status'); return r.ok; } catch { return false; }
}

export function toggleShare(cid: string) {
  patchCase(cid, c => ({ ...c, share: c.share ? { ...c.share, on: !c.share.on } : { token: Math.random().toString(36).slice(2, 10), on: true, at: now() } }), 'Changed report sharing');
}
export const saveConfig = (cfg: Cfg) => set(s => ({ ...s, config: cfg, logs: log(s, 'Admin changed score rules') }));
export const saveProfile = (p: { name: string; mobile: string; prefs: Prefs }) => set(s => ({ ...s, users: s.users.map(u => u.id === s.session ? { ...u, ...p } : u), logs: log(s, 'Updated profile') }));
export function deleteMyData() {
  set(s => { const uid = s.session!; return { ...s, users: s.users.filter(u => u.id !== uid), cases: s.cases.filter(c => c.ownerId !== uid), reviews: s.reviews.filter(r => r.userId !== uid), session: null, logs: [{ id: id('L'), at: now(), actor: 'System', action: 'User deleted all their data', target: uid }, ...s.logs.filter(l => l.actor !== s.users.find(u => u.id === uid)?.name)] }; });
}
