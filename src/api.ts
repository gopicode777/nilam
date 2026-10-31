/**
 * The ONLY place pages talk to the backend (Supabase). Pages read from the store cache (store.ts);
 * every write here goes to Supabase first-class and updates the cache so the UI stays instant.
 */
import { makeDoc, NEARBY_CATS, detectType } from './engine';
import { blankFields } from './docfields';
import { renderPdfPages } from './lib/pdfpages';
import { supabase } from './lib/supabase';
import { caseRow, hydrate, toCase, toDoc } from './data';
import { emptyState, get, set } from './store';
import type { Audit, Onboarding, Case, MapPlace, Cfg, Claim, Doc, DocType, Log, NearbyItem, Plot, Prefs, Review, User } from './types';

/** Bump when the privacy notice text changes; stored with each user's consent record. */
export const NOTICE_VERSION = '2026-10-v1';
const now = () => new Date().toISOString();
const rid = (p: string) => p + Math.random().toString(36).slice(2, 7);
export const me = (): User | undefined => get().users.find(u => u.id === get().session);

/** Show a visible error banner (App.tsx) instead of failing silently. */
function fail(e: unknown, what: string) {
  console.error(what, e);
  set(s => ({ ...s, err: `${what}. Please check your connection and try again.` }));
}
export const clearError = () => set(s => ({ ...s, err: undefined }));

function log(action: string, target?: string) {
  const u = me();
  const entry: Log = { id: rid('L'), at: now(), actor: u?.name ?? 'Visitor', action, target };
  set(s => ({ ...s, logs: [entry, ...s.logs].slice(0, 200) }));
  if (u) supabase.from('activity_logs').insert({ actor_id: u.id, actor: u.name, action, target }).then(({ error }) => { if (error) console.error(error); });
}

/* ---------------------------------------------------------------- auth */
let loading: { uid: string; p: Promise<unknown> } | null = null;
async function load(uid: string) {
  if (loading?.uid === uid) return loading.p;
  const p = (async () => {
    const r = await hydrate(uid);
    if (r === 'suspended') { await supabase.auth.signOut(); set(s => ({ ...s, ready: true, err: 'This account is suspended. Contact support.' })); }
    else if (r === 'error') set(s => ({ ...s, ready: true, err: 'Could not load your data. Refresh the page.' }));
    else { // Google sign-up skips the register form: save the consent that was ticked before the redirect
      const v = localStorage.getItem('la_consent');
      if (v) { localStorage.removeItem('la_consent'); const { count } = await supabase.from('consents').select('id', { count: 'exact', head: true }).eq('user_id', uid); if (!count) await supabase.from('consents').insert({ user_id: uid, purpose: 'account_and_audit_processing', notice_version: v }); }
    }
  })().finally(() => { loading = null; });
  loading = { uid, p }; return p;
}
let started = false;
/** Call once at startup. Restores the session and reacts to login, logout and password-reset links. */
export function initAuth() {
  if (started) return; started = true;
  supabase.auth.onAuthStateChange((ev, sess) => {
    // never await supabase calls inside this callback; defer them
    if (ev === 'PASSWORD_RECOVERY') set(s => ({ ...s, recovery: true }));
    if (ev === 'SIGNED_OUT') set(s => ({ ...emptyState(), lang: s.lang, theme: s.theme, ready: true }));
    if (sess?.user && (ev === 'SIGNED_IN' || ev === 'INITIAL_SESSION')) setTimeout(() => { if (!(get().session === sess.user.id && get().ready)) void load(sess.user.id); }, 0);
    if (ev === 'INITIAL_SESSION' && !sess) set(s => ({ ...s, ready: true }));
  });
}

export async function login(email: string, password: string): Promise<string | null> {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.user) return /confirm/i.test(error?.message ?? '') ? 'NOT_CONFIRMED' : /rate|many/i.test(error?.message ?? '') ? 'RATE' : 'BAD_CREDENTIALS';
  await load(data.user.id);
  return get().session ? null : 'SUSPENDED';
}
export async function startRegister(p: { name: string; email: string; mobile: string; pw: string }): Promise<string | null> {
  const { data, error } = await supabase.auth.signUp({ email: p.email.trim(), password: p.pw, options: { data: { name: p.name, mobile: p.mobile, consent_version: NOTICE_VERSION } } });
  if (error) return /registered|exists/i.test(error.message) ? 'EXISTS' : /rate|many|seconds/i.test(error.message) ? 'RATE' : 'ERROR';
  if (data.user && data.user.identities?.length === 0) return 'EXISTS'; // Supabase hides duplicates this way
  if (data.session) return 'SIGNED_IN'; // email confirmation is off in the project: already logged in
  set(s => ({ ...s, pending: { name: p.name, email: p.email.trim(), mobile: p.mobile } }));
  return null;
}
/** Sign in with Google (no email needed). Google must be enabled under Supabase > Authentication > Providers. */
export async function signInWithGoogle(): Promise<string | null> {
  localStorage.setItem('la_consent', NOTICE_VERSION);
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/' } });
  if (error) { localStorage.removeItem('la_consent'); return 'ERROR'; }
  return null;
}
export async function verifyOtp(code: string): Promise<boolean> {
  const p = get().pending; if (!p || !/^\d{6,8}$/.test(code)) return false;
  const { data, error } = await supabase.auth.verifyOtp({ email: p.email, token: code, type: 'signup' });
  if (error || !data.user) return false;
  set(s => ({ ...s, pending: undefined })); await load(data.user.id); return true;
}
export async function resendOtp(): Promise<boolean> {
  const p = get().pending; if (!p) return false;
  const { error } = await supabase.auth.resend({ type: 'signup', email: p.email }); return !error;
}
export async function forgotPassword(email: string): Promise<boolean> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + '/' }); return !error;
}
export async function updatePassword(pw: string): Promise<boolean> {
  const { error } = await supabase.auth.updateUser({ password: pw });
  if (!error) set(s => ({ ...s, recovery: false })); return !error;
}
export const logout = () => supabase.auth.signOut();
export const setLang = (lang: 'en' | 'ta') => set(s => ({ ...s, lang }));
export const toggleTheme = () => set(s => ({ ...s, theme: s.theme === 'light' ? 'dark' : 'light' }));

/* ---------------------------------------------------------------- cases */
export async function createCase(p: Partial<Case>): Promise<string> {
  const base = { district: 'Tiruvallur', taluk: '', village: '', survey: '', extent: 2400, seller: '', ptype: 'Residential plot', purpose: 'Buy and build', lat: 13.1439, lng: 79.9086, ...p };
  const { data, error } = await supabase.from('cases').insert({ district: base.district, taluk: base.taluk, village: base.village, survey: base.survey, extent: base.extent, seller: base.seller, ptype: base.ptype, purpose: base.purpose, lat: base.lat, lng: base.lng }).select().single();
  if (error || !data) { fail(error, 'Could not create the case'); throw error; }
  set(s => ({ ...s, cases: [toCase(data, []), ...s.cases] })); log('Created case', data.id); return data.id;
}
/** Change case fields, then save the case row. Documents have their own functions below. */
export function patchCase(cid: string, fn: (c: Case) => Case, action?: string) {
  let next: Case | undefined;
  set(s => ({ ...s, cases: s.cases.map(c => (c.id === cid ? (next = fn(c)) : c)) }));
  if (action) log(action, cid);
  if (next) supabase.from('cases').update(caseRow(next)).eq('id', cid).then(({ error }) => { if (error) fail(error, 'Could not save your changes'); });
}
const locTimer = new Map<string, ReturnType<typeof setTimeout>>();
/** Moves the pin instantly; saves to the database at most once per 1.5 s so live GPS does not flood it. */
export function setLocation(cid: string, lat: number, lng: number) {
  set(s => ({ ...s, cases: s.cases.map(c => (c.id === cid ? { ...c, lat, lng, nearby: undefined, nearbyAt: undefined } : c)) }));
  clearTimeout(locTimer.get(cid));
  locTimer.set(cid, setTimeout(() => {
    supabase.from('cases').update({ lat, lng, nearby: null, nearby_at: null }).eq('id', cid).then(({ error }) => { if (error) fail(error, 'Could not save the location'); });
  }, 1500));
}
export const setPlot = (cid: string, plot: Plot | null) => patchCase(cid, c => ({ ...c, plot: plot ?? undefined }), plot ? 'Drew plot boundary' : 'Removed plot boundary');
export const addClaim = (cid: string, cl: Omit<Claim, 'id'>) => patchCase(cid, c => ({ ...c, claims: [...c.claims, { ...cl, id: rid('K') }] }), 'Added claim');
export const removeClaim = (cid: string, kid: string) => patchCase(cid, c => ({ ...c, claims: c.claims.filter(k => k.id !== kid) }));
export function toggleShare(cid: string) {
  const token = crypto.randomUUID().replace(/-/g, '').slice(0, 20); // long random token: links can't be guessed
  patchCase(cid, c => ({ ...c, share: c.share ? { ...c.share, on: !c.share.on } : { token, on: true, at: now() } }), 'Changed report sharing');
}

/* ---------------------------------------------------------------- documents */
const putDoc = (cid: string, d: Doc) => set(s => ({ ...s, cases: s.cases.map(c => (c.id === cid ? { ...c, docs: [...c.docs, d] } : c)) }));
/** Real uploads start with blank fields and are read by the extract-document function. Sample docs (dev only) use demo values. */
async function insertDoc(cid: string, name: string, type: DocType, path?: string): Promise<string | null> {
  const c = get().cases.find(x => x.id === cid)!;
  const { data, error } = await supabase.from('documents').insert({ case_id: cid, type, name, storage_path: path ?? null, fields: path ? blankFields(type) : makeDoc(type, c, name, now()).fields, verified: false, ocr_status: path ? 'pending' : 'none', ocr_at: path ? now() : null }).select().single();
  if (error || !data) { fail(error, `Could not save ${name}`); return null; }
  putDoc(cid, toDoc(data)); return data.id;
}
/** Pages for the AI reader: PDFs are rendered to images in the browser (the model takes images only). Photos are read from storage on the server. */
async function pagesFor(path: string, name: string, file?: Blob): Promise<{ images: string[]; pageNos: number[] } | undefined> {
  if (!/\.pdf$/i.test(name)) return undefined;
  const blob = file ?? (await supabase.storage.from('documents').download(path)).data;
  if (!blob) throw new Error('file missing');
  return renderPdfPages(blob);
}
/** Asks the server to read a document with AI. Falls back to manual entry if it is not set up or fails. Returns an error code or null. */
export async function extractDoc(cid: string, did: string, file?: Blob): Promise<string | null> {
  patchDoc(cid, did, d => ({ ...d, ocr: 'pending' }));
  const doc = get().cases.find(c => c.id === cid)?.docs.find(d => d.id === did);
  let pages: { images: string[]; pageNos: number[] } | undefined;
  try { if (doc?.path) pages = await pagesFor(doc.path, doc.name, file); }
  catch (e) { console.error('pdf render', e); patchDoc(cid, did, d => ({ ...d, ocr: 'failed' })); return 'PDF_RENDER_FAILED'; }
  const { data, error } = await supabase.functions.invoke('extract-document', { body: { docId: did, images: pages?.images, pageNos: pages?.pageNos } });
  const code = (data as { error?: string } | null)?.error;
  const fields = (data as { fields?: Doc['fields'] } | null)?.fields;
  if (!error && fields) { patchDoc(cid, did, d => ({ ...d, fields, ocr: 'done', verified: false })); return null; }
  if (code === 'MODEL_UNAVAILABLE') set(s => ({ ...s, err: 'The AI reading model is unavailable. Enter values manually; the admin must update the model name.' }));
  patchDoc(cid, did, d => ({ ...d, ocr: code === 'OCR_NOT_CONFIGURED' ? 'not_configured' : 'failed' }));
  return code ?? 'ERROR';
}
/** Uploads the real files to private storage, then creates their document rows. Returns how many failed. */
export async function addFiles(cid: string, files: File[], forceType?: DocType): Promise<number> {
  const uid = get().session!; let failed = 0;
  for (const f of files) {
    const path = `${uid}/${cid}/${crypto.randomUUID()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const up = await supabase.storage.from('documents').upload(path, f, { contentType: f.type || undefined });
    if (up.error) { fail(up.error, `Could not upload ${f.name}`); failed++; continue; }
    const id = await insertDoc(cid, f.name, forceType ?? detectType(f.name), path);
    if (!id) { failed++; void supabase.storage.from('documents').remove([path]); } else void extractDoc(cid, id, f);
  }
  if (files.length > failed) log(`Uploaded ${files.length - failed} document(s)`, cid);
  return failed;
}
export async function addSampleDocs(cid: string) { for (const n of ['sale-deed.pdf', 'patta.pdf', 'ec.pdf']) await insertDoc(cid, n, detectType(n)); }
/** Short-lived link to open the original uploaded file. */
export async function fileUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 300); return error ? null : data.signedUrl;
}
const timers = new Map<string, ReturnType<typeof setTimeout>>();
function saveDoc(cid: string, did: string, delay = 0) {
  clearTimeout(timers.get(did));
  timers.set(did, setTimeout(() => {
    const d = get().cases.find(c => c.id === cid)?.docs.find(x => x.id === did); if (!d) return;
    supabase.from('documents').update({ fields: d.fields, verified: d.verified }).eq('id', did).then(({ error }) => { if (error) fail(error, 'Could not save the document values'); });
  }, delay));
}
const patchDoc = (cid: string, did: string, fn: (d: Doc) => Doc) =>
  set(s => ({ ...s, cases: s.cases.map(c => (c.id === cid ? { ...c, docs: c.docs.map(d => (d.id === did ? fn(d) : d)) } : c)) }));
export function updateField(cid: string, did: string, key: string, v: string) {
  patchDoc(cid, did, d => ({ ...d, verified: false, fields: { ...d.fields, [key]: { ...d.fields[key], v, conf: 100 } } })); saveDoc(cid, did, 600);
}
export function confirmDoc(cid: string, did: string, verified = true) {
  patchDoc(cid, did, d => ({ ...d, verified })); saveDoc(cid, did); if (verified) log('Confirmed document values', cid);
}
export async function removeDoc(cid: string, did: string) {
  const d = get().cases.find(c => c.id === cid)?.docs.find(x => x.id === did); if (!d) return;
  const { error } = await supabase.from('documents').delete().eq('id', did);
  if (error) return fail(error, 'Could not remove the document');
  if (d.path) void supabase.storage.from('documents').remove([d.path]);
  set(s => ({ ...s, cases: s.cases.map(c => (c.id === cid ? { ...c, docs: c.docs.filter(x => x.id !== did) } : c)) })); log('Removed document', cid);
}

/* ---------------------------------------------------------------- location + audit */
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

/** The audit runs on the server (run-audit function), which also charges the credit. Returns an error code, or null when it ran. */
export async function runAudit(cid: string): Promise<string | null> {
  const u = me()!;
  if (get().cases.find(x => x.id === cid)?.docs.some(d => d.ocr === 'pending')) return 'DOCS_PENDING';
  const { data, error } = await supabase.functions.invoke('run-audit', { body: { caseId: cid } });
  if (error) { fail(error, 'Could not run the audit'); return 'ERROR'; }
  const r = data as { error?: string; audit?: Audit; credits?: number | null };
  if (r.error) return r.error;
  set(s => ({ ...s, users: s.users.map(x => (x.id === u.id && typeof r.credits === 'number' ? { ...x, credits: r.credits } : x)), cases: s.cases.map(x => (x.id === cid ? { ...x, paid: true, audit: r.audit } : x)) }));
  return null;
}
/** AI answer about this case (from findings + extracted values only). Returns null when AI is not set up, so the caller can use its rule-based reply. */
export async function askAi(cid: string, question: string, lang: 'en' | 'ta'): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('ai-explain', { body: { caseId: cid, question, lang } });
  const r = data as { answer?: string; error?: string } | null;
  if (!error && r?.answer) return r.answer;
  if (r?.error === 'RATE_LIMIT') return lang === 'ta' ? 'ஒரு மணி நேரத்தில் அதிக கேள்விகள். சிறிது நேரம் கழித்து முயற்சிக்கவும்.' : 'Too many questions this hour. Please try again later.';
  return null;
}
/** The free Overpass servers often refuse the shared server IP. The browser has its own IP, so it fetches the data and hands it back. */
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
async function browserOverpass(query: string): Promise<unknown[] | null> {
  for (const ep of OVERPASS) {
    try {
      const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 25000);
      const r = await fetch(ep, { method: 'POST', body: 'data=' + encodeURIComponent(query), signal: ctrl.signal }).finally(() => clearTimeout(t));
      if (r.ok) return ((await r.json()).elements ?? []) as unknown[];
    } catch { /* try the next server */ }
  }
  return null;
}
type MapAnswer = { answer: string; places: MapPlace[]; cats: string[]; area: string; sparse?: boolean };
/** Map assistant: places and distances come from OpenStreetMap data, the AI only words the answer. */
export async function askMap(lat: number, lng: number, question: string, lang: 'en' | 'ta', lastCats?: string[]): Promise<MapAnswer | { error: string }> {
  let extra: Record<string, unknown> = {};
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase.functions.invoke('map-chat', { body: { lat, lng, question, lang, lastCats, ...extra } });
    const r = data as (Partial<MapAnswer> & { error?: string; query?: string; radiusM?: number }) | null;
    if (r?.error === 'NEED_CLIENT_DATA' && r.query) {
      const elements = await browserOverpass(r.query);
      if (!elements) return { error: 'DATA_UNAVAILABLE' };
      extra = { elements, useCats: r.cats, radiusM: r.radiusM }; continue;
    }
    if (error || !r || r.error || !r.answer) return { error: r?.error ?? 'ERROR' };
    return { answer: r.answer, places: r.places ?? [], cats: r.cats ?? [], area: r.area ?? '', sparse: r.sparse };
  }
  return { error: 'DATA_UNAVAILABLE' };
}
/** Online payments are not connected yet. Credits are added by an admin until a gateway (Razorpay) is wired. */
export const paymentsEnabled = false;
export function buyPack(_name: string, _credits: number, _amount: number) { return paymentsEnabled; }

export async function requestReview(caseId: string, kind: Review['kind'], prefer?: string) {
  const { data, error } = await supabase.from('reviews').insert({ case_id: caseId, kind, prefer: prefer ?? null }).select().single();
  if (error || !data) return fail(error, 'Could not send the review request');
  const r: Review = { id: data.id, caseId, userId: data.user_id, kind, status: 'requested', at: data.at, prefer };
  set(s => ({ ...s, reviews: [r, ...s.reviews] })); log(`Requested ${kind} review`, caseId);
}

/* ---------------------------------------------------------------- admin (RLS only lets admins succeed) */
export function adminUser(uid: string, fn: (u: User) => User, action: string) {
  const cur = get().users.find(u => u.id === uid); if (!cur) return; const n = fn(cur);
  set(s => ({ ...s, users: s.users.map(u => (u.id === uid ? n : u)) })); log(action, uid);
  supabase.from('profiles').update({ plan: n.plan, credits: n.credits, status: n.status, role: n.role }).eq('id', uid).then(({ error }) => { if (error) fail(error, 'Could not update the user'); });
}
export function adminReview(rid_: string, patch: Partial<Review>, action: string) {
  set(s => ({ ...s, reviews: s.reviews.map(r => (r.id === rid_ ? { ...r, ...patch } : r)) })); log(action, rid_);
  supabase.from('reviews').update({ status: patch.status, assignee: patch.assignee, remark: patch.remark }).eq('id', rid_).then(({ error }) => { if (error) fail(error, 'Could not update the review'); });
}
export async function pingOverpass(): Promise<boolean> { try { const r = await fetch('https://overpass-api.de/api/status'); return r.ok; } catch { return false; } }
export function saveConfig(cfg: Cfg) {
  set(s => ({ ...s, config: cfg })); log('Admin changed score rules');
  supabase.from('app_config').upsert({ id: 1, config: cfg, updated_at: now() }).then(({ error }) => { if (error) fail(error, 'Could not save the rules'); });
}

/* ---------------------------------------------------------------- profile */
export function saveProfile(p: { name: string; mobile: string; prefs: Prefs }) {
  set(s => ({ ...s, users: s.users.map(u => (u.id === s.session ? { ...u, ...p } : u)) })); log('Updated profile');
  supabase.from('profiles').update({ name: p.name, mobile: p.mobile, prefs: p.prefs }).eq('id', get().session!).then(({ error }) => { if (error) fail(error, 'Could not save your profile'); });
}
/** Remembers which welcome / tour / checklist steps this user has finished. */
export function setOnboarding(patch: Partial<Onboarding>) {
  const u = me(); if (!u) return; const next = { ...(u.onboarding ?? {}), ...patch };
  set(s => ({ ...s, users: s.users.map(x => (x.id === u.id ? { ...x, onboarding: next } : x)) }));
  supabase.from('profiles').update({ onboarding: next }).eq('id', u.id).then(({ error }) => { if (error) console.error(error); });
}
export const markAsked = () => { if (!me()?.onboarding?.asked) setOnboarding({ asked: true }); };
/** Deletes uploaded files, then the account and every case, document and review. */
export async function deleteMyData() {
  const paths = get().cases.filter(c => c.ownerId === get().session).flatMap(c => c.docs.map(d => d.path).filter(Boolean) as string[]);
  if (paths.length) await supabase.storage.from('documents').remove(paths);
  const { error } = await supabase.rpc('delete_my_account');
  if (error) return fail(error, 'Could not delete your account');
  await supabase.auth.signOut();
}

/** Public share link: the database only returns the case while the owner has sharing switched on. */
export async function fetchShared(token: string): Promise<Case | null> {
  const { data, error } = await supabase.rpc('get_shared_case', { p_token: token });
  if (error || !data) return null;
  const r = data as { case: Record<string, unknown>; docs: Record<string, unknown>[] };
  return toCase({ ...r.case, owner_id: '', share_token: token }, r.docs.map(toDoc));
}
