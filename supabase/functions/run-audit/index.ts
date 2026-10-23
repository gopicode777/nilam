// Runs the audit on the server so a client can never forge a score or skip the credit charge.
// Flow: verify the caller's JWT -> read THEIR case + documents (Row Level Security applies) -> analyze() -> charge via run_audit_for (service role only).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { analyze, DEFAULT_CFG } from './engine.ts';
import type { Case, Doc } from './types.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// deno-lint-ignore no-explicit-any
const toDoc = (r: any): Doc => ({ id: r.id, type: r.type, name: r.name, uploaded: r.uploaded, verified: r.verified, fields: r.fields ?? {} });
// deno-lint-ignore no-explicit-any
const toCase = (r: any, docs: Doc[]): Case => ({
  id: r.id, ownerId: r.owner_id, created: r.created, district: r.district, taluk: r.taluk, village: r.village, survey: r.survey, extent: Number(r.extent),
  seller: r.seller, ptype: r.ptype, purpose: r.purpose, lat: r.lat, lng: r.lng, radius: r.radius, claims: r.claims ?? [], docs,
  plot: r.plot ?? undefined, nearby: r.nearby ?? undefined, nearbyAt: r.nearby_at ?? undefined, audit: r.audit ?? undefined, paid: r.paid,
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!, anon = Deno.env.get('SUPABASE_ANON_KEY')!, svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userDb = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data: { user }, error: ue } = await userDb.auth.getUser();
    if (ue || !user) return json({ error: 'UNAUTHENTICATED' }, 401);
    const { caseId } = await req.json();
    if (typeof caseId !== 'string' || caseId.length > 40) return json({ error: 'BAD_REQUEST' }, 400);

    const { data: row } = await userDb.from('cases').select('*').eq('id', caseId).eq('owner_id', user.id).maybeSingle();
    if (!row) return json({ error: 'NOT_FOUND' });
    const { data: docs } = await userDb.from('documents').select('*').eq('case_id', caseId);
    const { data: cf } = await userDb.from('app_config').select('config').maybeSingle();

    const audit = analyze(toCase(row, (docs ?? []).map(toDoc)), cf?.config ?? DEFAULT_CFG);
    const db = createClient(url, svc);
    const { data: err, error } = await db.rpc('run_audit_for', { p_user: user.id, p_case: caseId, p_audit: audit });
    if (error) { console.error('run_audit_for', error); return json({ error: 'DB_ERROR' }, 500); }
    if (err) return json({ error: err });
    const { data: prof } = await db.from('profiles').select('credits').eq('id', user.id).single();
    return json({ audit, credits: prof?.credits ?? null });
  } catch (e) { console.error(e); return json({ error: 'SERVER_ERROR' }, 500); }
});
