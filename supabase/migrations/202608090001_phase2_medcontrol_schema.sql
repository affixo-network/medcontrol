-- MedControl Phase 2: database and RLS foundation.
-- This migration is version-controlled preparation only. It must be reviewed in
-- an isolated Supabase environment before any production deployment.

create type public.patient_role as enum ('owner', 'admin', 'caregiver', 'viewer');

create type public.membership_status as enum ('invited', 'accepted', 'revoked');

create type public.medication_schedule_type as enum ('daily', 'weekdays', 'explicit_dates');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  interface_language text not null default 'en',
  country text,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Non-secret user preferences. The primary key is always the matching auth.users id.';

comment on column public.profiles.id is
  'Immutable auth identity. Email is deliberately not an authorization boundary.';

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (btrim(display_name) <> ''),
  timezone text not null default 'UTC',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.patients is
  'Tenant root. Access is derived only from an accepted patient_memberships row.';

comment on column public.patients.created_by is
  'Immutable audit identity; it does not grant access by itself.';

create table public.patient_memberships (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  user_id uuid references auth.users(id) on delete restrict,
  role public.patient_role not null,
  status public.membership_status not null default 'invited',
  invited_email text,
  invited_by uuid not null references auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patient_memberships_state_check check (
    (status = 'invited' and invited_email is not null)
    or (status = 'accepted' and user_id is not null and accepted_at is not null)
    or status = 'revoked'
  )
);

create unique index patient_memberships_accepted_user_unique
  on public.patient_memberships(patient_id, user_id)
  where user_id is not null and status = 'accepted';

comment on table public.patient_memberships is
  'Authorization source. Only accepted rows grant access. invited_email is invitation metadata only.';

comment on column public.patient_memberships.invited_email is
  'May support invitations, but must never be used by RLS to grant tenant access.';

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  legacy_local_id text,
  name text not null check (btrim(name) <> ''),
  manufacturer text not null default '',
  content_value numeric not null check (content_value >= 0),
  content_unit text not null check (btrim(content_unit) <> ''),
  content_unit_other text not null default '',
  intake_quantity numeric not null check (intake_quantity >= 0),
  intake_unit text not null check (btrim(intake_unit) <> ''),
  intake_unit_other text not null default '',
  details text not null check (btrim(details) <> ''),
  sort_order integer not null default 0,
  active boolean not null default true,
  cancelled boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint medications_content_other_check check (
    content_unit <> 'other' or btrim(content_unit_other) <> ''
  ),
  constraint medications_intake_other_check check (
    intake_unit <> 'other' or btrim(intake_unit_other) <> ''
  )
);

create unique index medications_patient_legacy_local_id_unique
  on public.medications(patient_id, legacy_local_id)
  where legacy_local_id is not null;

comment on table public.medications is
  'Medication identity and mutable clinical display fields. Cancellation is a state transition, not a delete.';

comment on column public.medications.legacy_local_id is
  'Optional idempotency key for a later localStorage migration.';

create table public.medication_schedules (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  medication_id uuid not null unique references public.medications(id) on delete cascade,
  schedule_type public.medication_schedule_type not null,
  weekdays text[] not null default '{}',
  explicit_dates date[] not null default '{}',
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint medication_schedules_weekdays_check check (
    weekdays <@ array['Mon','Tue','Wed','Thu','Fri','Sat','Sun']::text[]
  ),
  constraint medication_schedules_dates_check check (
    (schedule_type = 'daily' and start_date is not null and end_date is not null and start_date <= end_date
      and cardinality(weekdays) = 0 and cardinality(explicit_dates) = 0)
    or (schedule_type = 'weekdays' and end_date is not null and cardinality(weekdays) > 0
      and cardinality(explicit_dates) = 0)
    or (schedule_type = 'explicit_dates' and cardinality(explicit_dates) > 0
      and start_date is null and end_date is null and cardinality(weekdays) = 0)
  )
);

comment on table public.medication_schedules is
  'One schedule rule per medication. patient_id is duplicated and consistency-enforced for direct RLS.';

create table public.medication_schedule_times (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  schedule_id uuid not null references public.medication_schedules(id) on delete cascade,
  time_of_day time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_id, time_of_day)
);

comment on table public.medication_schedule_times is
  'Normalized daily time slots for a medication schedule.';

create table public.medication_change_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete cascade,
  actor_user_id uuid not null default auth.uid() references auth.users(id),
  event_type text not null check (event_type in ('created','edited','cancelled','activated','deactivated','correction','reversal')),
  snapshot jsonb not null,
  changes jsonb not null default '{}'::jsonb,
  payload text,
  reverses_event_id uuid references public.medication_change_events(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.medication_change_events is
  'Append-only replacement for medication rowHistory. Corrections and reversals are new events.';

create table public.intake_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete cascade,
  actor_user_id uuid not null default auth.uid() references auth.users(id),
  event_type text not null check (event_type in ('taken','cancelled','correction','reversal')),
  planned_at timestamptz not null,
  actual_at timestamptz not null,
  status text,
  supersedes_event_id uuid references public.intake_events(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.intake_events is
  'Append-only replacement for intakeLogs. Effective state is derived from the event chain.';

comment on column public.intake_events.supersedes_event_id is
  'Correction/reversal reference; the prior event remains immutable.';

create index patient_memberships_access_idx
  on public.patient_memberships(user_id, patient_id, role)
  where status = 'accepted';

create index medications_patient_idx on public.medications(patient_id, sort_order);
create index medication_schedules_patient_idx on public.medication_schedules(patient_id);
create index medication_schedule_times_patient_idx on public.medication_schedule_times(patient_id, time_of_day);
create index medication_change_events_patient_idx on public.medication_change_events(patient_id, occurred_at);
create index intake_events_patient_idx on public.intake_events(patient_id, planned_at);

create function public.current_patient_role(target_patient_id uuid)
returns public.patient_role
language sql
stable
security definer
set search_path = ''
as $$
  select membership.role
  from public.patient_memberships as membership
  where membership.patient_id = target_patient_id
    and membership.user_id = auth.uid()
    and membership.status = 'accepted'
  limit 1
$$;

create function public.is_accepted_patient_member(target_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_patient_role(target_patient_id) is not null
$$;

create function public.can_write_patient(target_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_patient_role(target_patient_id) in ('owner', 'admin', 'caregiver')
$$;

create function public.can_admin_patient(target_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_patient_role(target_patient_id) in ('owner', 'admin')
$$;

revoke all on function public.current_patient_role(uuid) from public, anon;
revoke all on function public.is_accepted_patient_member(uuid) from public, anon;
revoke all on function public.can_write_patient(uuid) from public, anon;
revoke all on function public.can_admin_patient(uuid) from public, anon;
grant execute on function public.current_patient_role(uuid) to authenticated;
grant execute on function public.is_accepted_patient_member(uuid) to authenticated;
grant execute on function public.can_write_patient(uuid) to authenticated;
grant execute on function public.can_admin_patient(uuid) to authenticated;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create function public.enforce_tenant_identity_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.patient_id is distinct from old.patient_id then
    raise exception 'patient_id is immutable';
  end if;
  if tg_table_name = 'medications' and new.created_by is distinct from old.created_by then
    raise exception 'created_by is immutable';
  end if;
  if tg_table_name = 'medications' and new.legacy_local_id is distinct from old.legacy_local_id then
    raise exception 'legacy_local_id is immutable';
  end if;
  if tg_table_name = 'medication_schedules' and new.medication_id is distinct from old.medication_id then
    raise exception 'medication_id is immutable';
  end if;
  if tg_table_name = 'medication_schedule_times' and new.schedule_id is distinct from old.schedule_id then
    raise exception 'schedule_id is immutable';
  end if;
  return new;
end
$$;

create function public.enforce_row_identity_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'id is immutable';
  end if;
  if new.created_at is distinct from old.created_at then
    raise exception 'created_at is immutable';
  end if;
  return new;
end
$$;

create function public.enforce_patient_creator_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by is immutable';
  end if;
  return new;
end
$$;

create function public.enforce_membership_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.patient_id is distinct from old.patient_id then
    raise exception 'patient_id is immutable';
  end if;
  if new.invited_by is distinct from old.invited_by then
    raise exception 'invited_by is immutable';
  end if;
  if old.status = 'accepted' and new.user_id is distinct from old.user_id then
    raise exception 'accepted membership user_id is immutable';
  end if;
  if old.role = 'owner' and old.status = 'accepted'
     and (new.role <> 'owner' or new.status <> 'accepted')
     and not exists (
       select 1 from public.patient_memberships other
       where other.patient_id = old.patient_id
         and other.id <> old.id
         and other.role = 'owner'
         and other.status = 'accepted'
     ) then
    raise exception 'a patient must retain an accepted owner';
  end if;
  return new;
end
$$;

create function public.enforce_medication_relation_patient()
returns trigger
language plpgsql
set search_path = ''
as $$
declare expected_patient_id uuid;
begin
  if tg_table_name = 'medication_schedules' then
    select medication.patient_id into expected_patient_id
    from public.medications medication where medication.id = new.medication_id;
  elsif tg_table_name = 'medication_schedule_times' then
    select schedule.patient_id into expected_patient_id
    from public.medication_schedules schedule where schedule.id = new.schedule_id;
  else
    select medication.patient_id into expected_patient_id
    from public.medications medication where medication.id = new.medication_id;
  end if;
  if expected_patient_id is null or expected_patient_id <> new.patient_id then
    raise exception 'patient relationship mismatch';
  end if;
  return new;
end
$$;

create function public.reject_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name;
end
$$;

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger profiles_identity_guard before update on public.profiles
for each row execute function public.enforce_row_identity_immutable();
create trigger patients_updated_at before update on public.patients
for each row execute function public.set_updated_at();
create trigger patients_identity_guard before update on public.patients
for each row execute function public.enforce_row_identity_immutable();
create trigger patients_creator_guard before update on public.patients
for each row execute function public.enforce_patient_creator_immutable();
create trigger patient_memberships_updated_at before update on public.patient_memberships
for each row execute function public.set_updated_at();
create trigger patient_memberships_identity_guard before update on public.patient_memberships
for each row execute function public.enforce_row_identity_immutable();
create trigger patient_memberships_guard before update on public.patient_memberships
for each row execute function public.enforce_membership_update();
create trigger medications_updated_at before update on public.medications
for each row execute function public.set_updated_at();
create trigger medications_row_identity_guard before update on public.medications
for each row execute function public.enforce_row_identity_immutable();
create trigger medications_identity_guard before update on public.medications
for each row execute function public.enforce_tenant_identity_immutable();
create trigger medication_schedules_updated_at before update on public.medication_schedules
for each row execute function public.set_updated_at();
create trigger medication_schedules_row_identity_guard before update on public.medication_schedules
for each row execute function public.enforce_row_identity_immutable();
create trigger medication_schedules_identity_guard before update on public.medication_schedules
for each row execute function public.enforce_tenant_identity_immutable();
create trigger medication_schedules_patient_guard before insert or update on public.medication_schedules
for each row execute function public.enforce_medication_relation_patient();
create trigger medication_schedule_times_updated_at before update on public.medication_schedule_times
for each row execute function public.set_updated_at();
create trigger medication_schedule_times_row_identity_guard before update on public.medication_schedule_times
for each row execute function public.enforce_row_identity_immutable();
create trigger medication_schedule_times_identity_guard before update on public.medication_schedule_times
for each row execute function public.enforce_tenant_identity_immutable();
create trigger medication_schedule_times_patient_guard before insert or update on public.medication_schedule_times
for each row execute function public.enforce_medication_relation_patient();
create trigger medication_change_events_patient_guard before insert on public.medication_change_events
for each row execute function public.enforce_medication_relation_patient();
create trigger intake_events_patient_guard before insert on public.intake_events
for each row execute function public.enforce_medication_relation_patient();
create trigger medication_change_events_append_only before update or delete on public.medication_change_events
for each row execute function public.reject_event_mutation();
create trigger intake_events_append_only before update or delete on public.intake_events
for each row execute function public.reject_event_mutation();

alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.patient_memberships enable row level security;
alter table public.medications enable row level security;
alter table public.medication_schedules enable row level security;
alter table public.medication_schedule_times enable row level security;
alter table public.medication_change_events enable row level security;
alter table public.intake_events enable row level security;

revoke all on table public.profiles, public.patients, public.patient_memberships,
  public.medications, public.medication_schedules, public.medication_schedule_times,
  public.medication_change_events, public.intake_events from public, anon;

grant select, insert, update on public.profiles to authenticated;
grant select, update on public.patients to authenticated;
grant select, insert, update on public.patient_memberships to authenticated;
grant select, insert, update on public.medications to authenticated;
grant select, insert, update on public.medication_schedules to authenticated;
grant select, insert, update, delete on public.medication_schedule_times to authenticated;
grant select, insert on public.medication_change_events, public.intake_events to authenticated;

create policy profiles_select_self on public.profiles for select to authenticated
using (id = auth.uid());
create policy profiles_insert_self on public.profiles for insert to authenticated
with check (id = auth.uid());
create policy profiles_update_self on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());
create policy patients_select_member on public.patients for select to authenticated
using (public.is_accepted_patient_member(id));
create policy patients_update_admin on public.patients for update to authenticated
using (public.can_admin_patient(id)) with check (public.can_admin_patient(id));
create policy memberships_select_member on public.patient_memberships for select to authenticated
using (public.is_accepted_patient_member(patient_id));
create policy memberships_insert_admin on public.patient_memberships for insert to authenticated
with check (
  public.can_admin_patient(patient_id)
  and invited_by = auth.uid()
  and (role <> 'owner' or public.current_patient_role(patient_id) = 'owner')
);
create policy memberships_update_admin on public.patient_memberships for update to authenticated
using (
  public.can_admin_patient(patient_id)
  and (role <> 'owner' or public.current_patient_role(patient_id) = 'owner')
)
with check (
  public.can_admin_patient(patient_id)
  and (role <> 'owner' or public.current_patient_role(patient_id) = 'owner')
);
create policy medications_select_member on public.medications for select to authenticated
using (public.is_accepted_patient_member(patient_id));
create policy medications_insert_writer on public.medications for insert to authenticated
with check (public.can_write_patient(patient_id) and created_by = auth.uid());
create policy medications_update_writer on public.medications for update to authenticated
using (public.can_write_patient(patient_id)) with check (public.can_write_patient(patient_id));
create policy medication_schedules_select_member on public.medication_schedules for select to authenticated
using (public.is_accepted_patient_member(patient_id));
create policy medication_schedules_insert_writer on public.medication_schedules for insert to authenticated
with check (public.can_write_patient(patient_id));
create policy medication_schedules_update_writer on public.medication_schedules for update to authenticated
using (public.can_write_patient(patient_id)) with check (public.can_write_patient(patient_id));
create policy medication_schedule_times_select_member on public.medication_schedule_times for select to authenticated
using (public.is_accepted_patient_member(patient_id));
create policy medication_schedule_times_insert_writer on public.medication_schedule_times for insert to authenticated
with check (public.can_write_patient(patient_id));
create policy medication_schedule_times_update_writer on public.medication_schedule_times for update to authenticated
using (public.can_write_patient(patient_id)) with check (public.can_write_patient(patient_id));
create policy medication_schedule_times_delete_writer on public.medication_schedule_times for delete to authenticated
using (public.can_write_patient(patient_id));
create policy medication_change_events_select_member on public.medication_change_events for select to authenticated
using (public.is_accepted_patient_member(patient_id));
create policy medication_change_events_insert_writer on public.medication_change_events for insert to authenticated
with check (public.can_write_patient(patient_id) and actor_user_id = auth.uid());
create policy intake_events_select_member on public.intake_events for select to authenticated
using (public.is_accepted_patient_member(patient_id));
create policy intake_events_insert_writer on public.intake_events for insert to authenticated
with check (public.can_write_patient(patient_id) and actor_user_id = auth.uid());

create function public.create_patient(patient_name text, patient_timezone text default 'UTC')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare new_patient_id uuid := gen_random_uuid();
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  insert into public.patients (id, display_name, timezone, created_by)
  values (new_patient_id, patient_name, patient_timezone, auth.uid());
  insert into public.patient_memberships
    (patient_id, user_id, role, status, invited_by, accepted_at)
  values
    (new_patient_id, auth.uid(), 'owner', 'accepted', auth.uid(), now());
  return new_patient_id;
end
$$;

-- One call creates the medication, its schedule, all times, and the initial
-- append-only history event in the caller's transaction.
create function public.create_medication_with_schedule(
  target_patient_id uuid,
  medication_data jsonb,
  schedule_data jsonb,
  schedule_times time[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_medication_id uuid := gen_random_uuid();
  new_schedule_id uuid := gen_random_uuid();
  slot time;
begin
  if not public.can_write_patient(target_patient_id) then
    raise exception 'patient write access denied';
  end if;
  if coalesce(cardinality(schedule_times), 0) = 0 then
    raise exception 'at least one schedule time is required';
  end if;

  insert into public.medications (
    id, patient_id, legacy_local_id, name, manufacturer,
    content_value, content_unit, content_unit_other,
    intake_quantity, intake_unit, intake_unit_other,
    details, sort_order, active, cancelled, created_by
  ) values (
    new_medication_id, target_patient_id, medication_data ->> 'legacyLocalId',
    medication_data ->> 'name', coalesce(medication_data ->> 'manufacturer', ''),
    (medication_data ->> 'contentValue')::numeric, medication_data ->> 'contentUnit',
    coalesce(medication_data ->> 'contentUnitOther', ''),
    (medication_data ->> 'intakeQuantity')::numeric, medication_data ->> 'intakeUnit',
    coalesce(medication_data ->> 'intakeUnitOther', ''), medication_data ->> 'details',
    coalesce((medication_data ->> 'order')::integer, 0),
    coalesce((medication_data ->> 'active')::boolean, true), false, auth.uid()
  );

  insert into public.medication_schedules (
    id, patient_id, medication_id, schedule_type, weekdays,
    explicit_dates, start_date, end_date
  ) values (
    new_schedule_id, target_patient_id, new_medication_id,
    (schedule_data ->> 'scheduleType')::public.medication_schedule_type,
    coalesce(array(select jsonb_array_elements_text(schedule_data -> 'weekdays')), '{}'),
    coalesce(array(select value::date from jsonb_array_elements_text(schedule_data -> 'explicitDates')), '{}'),
    nullif(schedule_data ->> 'startDate', '')::date,
    nullif(schedule_data ->> 'endDate', '')::date
  );

  foreach slot in array schedule_times loop
    insert into public.medication_schedule_times (patient_id, schedule_id, time_of_day)
    values (target_patient_id, new_schedule_id, slot);
  end loop;

  insert into public.medication_change_events (
    patient_id, medication_id, actor_user_id, event_type, snapshot, changes, payload
  ) values (
    target_patient_id, new_medication_id, auth.uid(), 'created',
    medication_data || schedule_data || jsonb_build_object('times', schedule_times),
    medication_data || schedule_data || jsonb_build_object('times', schedule_times),
    'Created through create_medication_with_schedule'
  );

  return new_medication_id;
end
$$;

revoke all on function public.create_patient(text, text) from public, anon;
revoke all on function public.create_medication_with_schedule(uuid, jsonb, jsonb, time[]) from public, anon;
grant execute on function public.create_patient(text, text) to authenticated;
grant execute on function public.create_medication_with_schedule(uuid, jsonb, jsonb, time[]) to authenticated;
