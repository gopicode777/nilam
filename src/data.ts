/** Supabase row <-> app model mappers, and the one-shot loader used after login. */
import { supabase } from './lib/supabase';
import { set } from './store';
import type { Case, Doc, Log, Payment, Review, User } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const toUser = (r: any): User => ({ id: r.id, name: r.name, email: r.email, mobile: r.mobile, role: r.role, plan: r.plan, credits: r.credits, joined: r.joined, status: r.status, prefs: r.prefs });
export const toDoc = (r: any): Doc => ({ id: r.id, type: r.type, name: r.name, uploaded: r.uploaded, verified: r.verified, fields: r.fields ?? {}, path: r.storage_path ?? undefined, ocr: r.ocr_status === 'pending' && Date.now() - new Date(r.ocr_at ?? 0).getTime() > 180000 ? 'failed' : r.ocr_status });
export const toCase = (r: any, docs: Doc[]): Case => ({
  id: r.id, ownerId: r.owner_id, created: r.created, district: r.district, taluk: r.taluk, village: r.village, survey: r.survey, extent: Number(r.extent),
  seller: r.seller, ptype: r.ptype, purpose: r.purpose, lat: r.lat, lng: r.lng, radius: r.radius, claims: r.claims ?? [], docs,
  plot: r.plot ?? undefined, nearby: r.nearby ?? undefined, nearbyAt: r.nearby_at ?? undefined, audit: r.audit ?? undefined, paid: r.paid,
  share: r.share_token ? { token: r.share_token, on: r.share_on, at: r.share_at ?? r.created } : undefined,
});
/** Only the columns a case row stores (documents live in their own table). */
export const caseRow = (c: Case) => ({
  district: c.district, taluk: c.taluk, village: c.village, survey: c.survey, extent: c.extent, seller: c.seller, ptype: c.ptype, purpose: c.purpose,
  lat: c.lat, lng: c.lng, radius: c.radius, claims: c.claims, plot: c.plot ?? null, nearby: c.nearby ?? null, nearby_at: c.nearbyAt ?? null,
  share_token: c.share?.token ?? null, share_on: c.share?.on ?? false, share_at: c.share?.at ?? null,
});
const toReview = (r: any): Review => ({ id: r.id, caseId: r.case_id, userId: r.user_id, kind: r.kind, status: r.status, prefer: r.prefer ?? undefined, assignee: r.assignee ?? undefined, remark: r.remark ?? undefined, at: r.at });
const toLog = (r: any): Log => ({ id: String(r.id), at: r.at, actor: r.actor, action: r.action, target: r.target ?? undefined });
const toPay = (r: any): Payment => ({ id: r.id, userId: r.user_id, pack: r.pack, credits: r.credits, amount: Number(r.amount), at: r.at });

/** Loads everything the signed-in user may see. Row Level Security decides the scope: a normal user gets their own rows, an admin gets all rows. */
export async function hydrate(uid: string): Promise<'ok' | 'suspended' | 'error'> {
  const [pr, cs, ds, rv, lg, py, cf] = await Promise.all([
    supabase.from('profiles').select('*'),
    supabase.from('cases').select('*').order('created', { ascending: false }),
    supabase.from('documents').select('*').order('uploaded', { ascending: true }),
    supabase.from('reviews').select('*').order('at', { ascending: false }),
    supabase.from('activity_logs').select('*').order('at', { ascending: false }).limit(200),
    supabase.from('payments').select('*').order('at', { ascending: false }),
    supabase.from('app_config').select('config').maybeSingle(),
  ]);
  const bad = [pr, cs, ds, rv, lg, py].find(x => x.error);
  if (bad?.error) { console.error(bad.error); return 'error'; }
  const users = (pr.data ?? []).map(toUser), me = users.find(u => u.id === uid);
  if (!me) return 'error';
  if (me.status === 'suspended') return 'suspended';
  const docsBy = new Map<string, Doc[]>();
  (ds.data ?? []).forEach((d: any) => docsBy.set(d.case_id, [...(docsBy.get(d.case_id) ?? []), toDoc(d)]));
  set(s => ({
    ...s, users, session: uid, ready: true,
    cases: (cs.data ?? []).map((c: any) => toCase(c, docsBy.get(c.id) ?? [])),
    reviews: (rv.data ?? []).map(toReview), logs: (lg.data ?? []).map(toLog), payments: (py.data ?? []).map(toPay),
    config: (cf.data?.config as any) ?? undefined,
  }));
  return 'ok';
}
