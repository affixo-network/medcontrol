-- Additive persistence layer for the current modular MedControl UI.
-- Existing legacy public tables are intentionally left untouched.

create table if not exists public.mc_patients (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default 'MedControl',
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_user_id)
);

create table if not exists public.mc_medications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.mc_patients(id) on delete cascade,
  legacy_local_id text not null,
  data jsonb not null default '{}'::jsonb,
  cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(patient_id, legacy_local_id)
);

create table if not exists public.mc_medication_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.mc_patients(id) on delete cascade,
  medication_id uuid not null references public.mc_medications(id) on delete cascade,
  legacy_event_id text not null,
  event_type text not null check (event_type in ('created','edited','cancelled','restored')),
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(patient_id, legacy_event_id)
);

create table if not exists public.mc_intake_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.mc_patients(id) on delete cascade,
  medication_id uuid not null references public.mc_medications(id) on delete cascade,
  legacy_event_id text not null,
  event_type text not null check (event_type in ('taken','correction','reversal')),
  planned_at timestamptz not null,
  actual_at timestamptz,
  status text,
  supersedes_event_id uuid references public.mc_intake_events(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(patient_id, legacy_event_id)
);

create index if not exists mc_medications_patient_idx on public.mc_medications(patient_id, updated_at);
create index if not exists mc_medication_events_patient_idx on public.mc_medication_events(patient_id, created_at);
create index if not exists mc_intake_events_slot_idx on public.mc_intake_events(patient_id, medication_id, planned_at, created_at);

alter table public.mc_patients enable row level security;
alter table public.mc_medications enable row level security;
alter table public.mc_medication_events enable row level security;
alter table public.mc_intake_events enable row level security;

revoke all on public.mc_patients, public.mc_medications, public.mc_medication_events, public.mc_intake_events from public, anon;
grant select, insert, update on public.mc_patients, public.mc_medications to authenticated;
grant select, insert on public.mc_medication_events, public.mc_intake_events to authenticated;

create or replace function public.mc_owns_patient(target_patient_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.mc_patients p where p.id=target_patient_id and p.owner_user_id=auth.uid()) $$;

revoke all on function public.mc_owns_patient(uuid) from public, anon;
grant execute on function public.mc_owns_patient(uuid) to authenticated;

drop policy if exists mc_patients_owner on public.mc_patients;
create policy mc_patients_owner on public.mc_patients for all to authenticated
using (owner_user_id=auth.uid()) with check (owner_user_id=auth.uid());

drop policy if exists mc_medications_owner on public.mc_medications;
create policy mc_medications_owner on public.mc_medications for all to authenticated
using (public.mc_owns_patient(patient_id)) with check (public.mc_owns_patient(patient_id));

drop policy if exists mc_medication_events_owner on public.mc_medication_events;
create policy mc_medication_events_owner on public.mc_medication_events for select to authenticated
using (public.mc_owns_patient(patient_id));
create policy mc_medication_events_insert_owner on public.mc_medication_events for insert to authenticated
with check (public.mc_owns_patient(patient_id));

drop policy if exists mc_intake_events_owner on public.mc_intake_events;
create policy mc_intake_events_owner on public.mc_intake_events for select to authenticated
using (public.mc_owns_patient(patient_id));
create policy mc_intake_events_insert_owner on public.mc_intake_events for insert to authenticated
with check (public.mc_owns_patient(patient_id));

create or replace function public.mc_get_or_create_patient(patient_timezone text default 'UTC')
returns uuid language plpgsql security definer set search_path=''
as $$
declare pid uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select id into pid from public.mc_patients where owner_user_id=auth.uid();
  if pid is null then
    insert into public.mc_patients(owner_user_id,timezone) values(auth.uid(),coalesce(nullif(patient_timezone,''),'UTC')) returning id into pid;
  else
    update public.mc_patients set timezone=coalesce(nullif(patient_timezone,''),timezone),updated_at=now() where id=pid;
  end if;
  return pid;
end $$;

create or replace function public.mc_upsert_medication(target_patient_id uuid, target_legacy_local_id text, target_data jsonb, target_cancelled boolean default false)
returns uuid language plpgsql security definer set search_path=''
as $$
declare mid uuid;
begin
  if not public.mc_owns_patient(target_patient_id) then raise exception 'Patient access denied'; end if;
  insert into public.mc_medications(patient_id,legacy_local_id,data,cancelled)
  values(target_patient_id,target_legacy_local_id,coalesce(target_data,'{}'::jsonb),coalesce(target_cancelled,false))
  on conflict(patient_id,legacy_local_id) do update set data=excluded.data,cancelled=excluded.cancelled,updated_at=now()
  returning id into mid;
  return mid;
end $$;

revoke all on function public.mc_get_or_create_patient(text) from public, anon;
revoke all on function public.mc_upsert_medication(uuid,text,jsonb,boolean) from public, anon;
grant execute on function public.mc_get_or_create_patient(text) to authenticated;
grant execute on function public.mc_upsert_medication(uuid,text,jsonb,boolean) to authenticated;
