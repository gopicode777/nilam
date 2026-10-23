-- LandAudit AI database. Already applied to project ygbsrdiiulvuadiubdms (ap-south-1).
-- To rebuild in a fresh Supabase project: paste this whole file in SQL Editor and run once.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '', email text not null default '', mobile text not null default '',
  role text not null default 'user' check (role in ('user','admin')),
  plan text not null default 'free' check (plan in ('free','pro','professional','business')),
  credits int not null default 1 check (credits >= 0),
  status text not null default 'active' check (status in ('active','suspended')),
  prefs jsonb not null default '{"email":true,"whatsapp":false,"alerts":true}'::jsonb,
  joined timestamptz not null default now()
);
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'active'); $$;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, mobile)
  values (new.id, coalesce(new.raw_user_meta_data->>'name',''), coalesce(new.email,''), coalesce(new.raw_user_meta_data->>'mobile',''));
  return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
-- users cannot change role/plan/credits/status themselves; admins and our own trusted functions can
create or replace function public.protect_profile() returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated','anon') and not public.is_admin() then
    if new.role <> old.role or new.plan <> old.plan or new.credits <> old.credits or new.status <> old.status or new.email <> old.email or new.id <> old.id then
      raise exception 'Not allowed to change protected profile fields'; end if;
  end if; return new; end $$;
create trigger protect_profile_fields before update on public.profiles for each row execute function public.protect_profile();

create table public.cases (
  id text primary key default ('C-' || upper(substr(md5(random()::text || clock_timestamp()::text),1,6))),
  owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  created timestamptz not null default now(),
  district text not null default 'Tiruvallur', taluk text not null default '', village text not null default '', survey text not null default '',
  extent numeric not null default 0, seller text not null default '', ptype text not null default 'Residential plot', purpose text not null default 'Buy and build',
  lat double precision not null default 13.1439, lng double precision not null default 79.9086, radius int not null default 2000,
  claims jsonb not null default '[]'::jsonb, nearby jsonb, nearby_at timestamptz, audit jsonb, paid boolean not null default false,
  share_token text unique, share_on boolean not null default false, share_at timestamptz
);
create index cases_owner_idx on public.cases(owner_id);

create table public.documents (
  id text primary key default ('D-' || substr(md5(random()::text || clock_timestamp()::text),1,8)),
  case_id text not null references public.cases(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  type text not null, name text not null, storage_path text, uploaded timestamptz not null default now(),
  verified boolean not null default false, fields jsonb not null default '{}'::jsonb
);
create index documents_case_idx on public.documents(case_id);
create index documents_owner_idx on public.documents(owner_id);

create table public.reviews (
  id text primary key default ('R-' || substr(md5(random()::text || clock_timestamp()::text),1,8)),
  case_id text not null references public.cases(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('advocate','surveyor','planner','valuer')),
  status text not null default 'requested' check (status in ('requested','assigned','completed')),
  prefer text, assignee text, remark text, at timestamptz not null default now()
);
create index reviews_user_idx on public.reviews(user_id);
create index reviews_case_idx on public.reviews(case_id);

create table public.activity_logs (
  id bigint generated always as identity primary key, at timestamptz not null default now(),
  actor_id uuid default auth.uid() references public.profiles(id) on delete set null, actor text not null default 'Visitor', action text not null, target text
);
create index activity_logs_at_idx on public.activity_logs(at desc);
create index activity_logs_actor_idx on public.activity_logs(actor_id);

create table public.payments (
  id text primary key default ('P-' || substr(md5(random()::text || clock_timestamp()::text),1,8)),
  user_id uuid not null references public.profiles(id) on delete cascade, pack text not null, credits int not null, amount numeric not null,
  provider text, provider_ref text, at timestamptz not null default now()
);
create index payments_user_idx on public.payments(user_id);
create table public.app_config (id int primary key default 1 check (id = 1), config jsonb not null, updated_at timestamptz not null default now());

alter table public.profiles enable row level security; alter table public.cases enable row level security; alter table public.documents enable row level security;
alter table public.reviews enable row level security; alter table public.activity_logs enable row level security; alter table public.payments enable row level security; alter table public.app_config enable row level security;

create policy "profiles_select_own_or_admin" on public.profiles for select to authenticated using (id = (select auth.uid()) or public.is_admin());
create policy "profiles_update_own_or_admin" on public.profiles for update to authenticated using (id = (select auth.uid()) or public.is_admin()) with check (id = (select auth.uid()) or public.is_admin());
create policy "cases_select" on public.cases for select to authenticated using (owner_id = (select auth.uid()) or public.is_admin());
create policy "cases_insert" on public.cases for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "cases_update" on public.cases for update to authenticated using (owner_id = (select auth.uid()) or public.is_admin()) with check (owner_id = (select auth.uid()) or public.is_admin());
create policy "cases_delete" on public.cases for delete to authenticated using (owner_id = (select auth.uid()) or public.is_admin());
create policy "documents_select" on public.documents for select to authenticated using (owner_id = (select auth.uid()) or public.is_admin());
create policy "documents_insert" on public.documents for insert to authenticated with check (owner_id = (select auth.uid()) and exists (select 1 from public.cases c where c.id = case_id and c.owner_id = (select auth.uid())));
create policy "documents_update" on public.documents for update to authenticated using (owner_id = (select auth.uid()) or public.is_admin()) with check (owner_id = (select auth.uid()) or public.is_admin());
create policy "documents_delete" on public.documents for delete to authenticated using (owner_id = (select auth.uid()) or public.is_admin());
create policy "reviews_select" on public.reviews for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy "reviews_insert" on public.reviews for insert to authenticated with check (user_id = (select auth.uid()) and status = 'requested' and exists (select 1 from public.cases c where c.id = case_id and c.owner_id = (select auth.uid())));
create policy "reviews_admin_update" on public.reviews for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "logs_select" on public.activity_logs for select to authenticated using (actor_id = (select auth.uid()) or public.is_admin());
create policy "logs_insert" on public.activity_logs for insert to authenticated with check (actor_id = (select auth.uid()));
create policy "payments_select" on public.payments for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy "payments_admin_insert" on public.payments for insert to authenticated with check (public.is_admin());
create policy "config_select" on public.app_config for select to authenticated using (true);
create policy "config_admin_write" on public.app_config for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.run_audit(p_case text, p_audit jsonb) returns text language plpgsql security definer set search_path = public as $$
declare c public.cases; u public.profiles;
begin
  select * into c from public.cases where id = p_case and owner_id = auth.uid();
  if not found then return 'NOT_FOUND'; end if;
  select * into u from public.profiles where id = auth.uid() for update;
  if not c.paid then
    if u.credits < 1 then return 'NO_CREDITS'; end if;
    update public.profiles set credits = credits - 1 where id = u.id;
  end if;
  update public.cases set paid = true, audit = p_audit where id = p_case;
  insert into public.activity_logs(actor_id, actor, action, target) values (u.id, u.name, 'Ran audit', p_case);
  return null; end $$;
create or replace function public.get_shared_case(p_token text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('case', to_jsonb(c) - 'owner_id' - 'share_token',
    'docs', coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'type',d.type,'name',d.name,'verified',d.verified,'fields',d.fields)) from public.documents d where d.case_id = c.id), '[]'::jsonb))
  from public.cases c where c.share_token = p_token and c.share_on = true limit 1; $$;
create or replace function public.delete_my_account() returns void language plpgsql security definer set search_path = public, auth as $$
begin if auth.uid() is null then raise exception 'not signed in'; end if; delete from auth.users where id = auth.uid(); end $$;

revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.protect_profile() from anon, authenticated, public;
revoke execute on function public.is_admin() from anon, public;       grant execute on function public.is_admin() to authenticated;
revoke execute on function public.run_audit(text, jsonb) from anon, public; grant execute on function public.run_audit(text, jsonb) to authenticated;
revoke execute on function public.delete_my_account() from anon, public;    grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.get_shared_case(text) to anon, authenticated;  -- public share link, only returns cases with sharing ON

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents','documents', false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp']) on conflict (id) do nothing;
create policy "docs_read_own" on storage.objects for select to authenticated using (bucket_id = 'documents' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));
create policy "docs_upload_own" on storage.objects for insert to authenticated with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "docs_update_own" on storage.objects for update to authenticated using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "docs_delete_own" on storage.objects for delete to authenticated using (bucket_id = 'documents' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));

-- ===== v2: plot boundary + DPDP consent record =====
alter table public.cases add column if not exists plot jsonb;   -- {"pts": [[lat,lng],...], "areaSqft": number}
create table public.consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  purpose text not null, notice_version text not null, granted boolean not null default true, at timestamptz not null default now()
);
create index consents_user_idx on public.consents(user_id);
alter table public.consents enable row level security;
create policy "consents_select" on public.consents for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy "consents_insert_own" on public.consents for insert to authenticated with check (user_id = (select auth.uid()));  -- append-only: no update/delete policies
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, mobile)
  values (new.id, coalesce(new.raw_user_meta_data->>'name',''), coalesce(new.email,''), coalesce(new.raw_user_meta_data->>'mobile',''));
  if coalesce(new.raw_user_meta_data->>'consent_version','') <> '' then
    insert into public.consents (user_id, purpose, notice_version) values (new.id, 'account_and_audit_processing', new.raw_user_meta_data->>'consent_version');
  end if;
  return new; end $$;

-- ===== v3: server-side audit + OCR state =====
alter table public.documents
  add column if not exists ocr_status text not null default 'none' check (ocr_status in ('none','pending','done','failed','not_configured')),
  add column if not exists ocr_at timestamptz;
create or replace function public.protect_case_fields() returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated','anon') and not public.is_admin() then
    if tg_op = 'INSERT' then new.paid := false; new.audit := null;
    elsif new.audit is distinct from old.audit or new.paid is distinct from old.paid or new.owner_id <> old.owner_id then
      raise exception 'Audit result and payment status can only be set by the server'; end if;
  end if; return new; end $$;
create trigger protect_case_fields before insert or update on public.cases for each row execute function public.protect_case_fields();
revoke execute on function public.protect_case_fields() from anon, authenticated, public;
drop function if exists public.run_audit(text, jsonb);   -- replaced by the run-audit Edge Function
create or replace function public.run_audit_for(p_user uuid, p_case text, p_audit jsonb) returns text language plpgsql security definer set search_path = public as $$
declare c public.cases; u public.profiles;
begin
  select * into c from public.cases where id = p_case and owner_id = p_user;
  if not found then return 'NOT_FOUND'; end if;
  select * into u from public.profiles where id = p_user for update;
  if not c.paid then
    if u.credits < 1 then return 'NO_CREDITS'; end if;
    update public.profiles set credits = credits - 1 where id = u.id;
  end if;
  update public.cases set paid = true, audit = p_audit where id = p_case;
  insert into public.activity_logs(actor_id, actor, action, target) values (u.id, u.name, 'Ran audit', p_case);
  return null; end $$;
revoke execute on function public.run_audit_for(uuid, text, jsonb) from anon, authenticated, public;
grant execute on function public.run_audit_for(uuid, text, jsonb) to service_role;

-- ===== v4: AI chat rate limit =====
create table public.ai_usage (id bigint generated always as identity primary key, user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade, kind text not null default 'chat', at timestamptz not null default now());
create index ai_usage_user_at_idx on public.ai_usage(user_id, at desc);
alter table public.ai_usage enable row level security;
create policy "ai_usage_select_own" on public.ai_usage for select to authenticated using (user_id = (select auth.uid()));
create policy "ai_usage_insert_own" on public.ai_usage for insert to authenticated with check (user_id = (select auth.uid()));

-- ===== v5: 5 free audits per new user =====
alter table public.profiles alter column credits set default 5;
-- first admin: update public.profiles set role = 'admin', credits = 10 where email = 'you@example.com';
