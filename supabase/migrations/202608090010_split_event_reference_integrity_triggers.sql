drop trigger if exists intake_events_reference_tenant_integrity on public.intake_events;
drop trigger if exists medication_change_events_reference_tenant_integrity on public.medication_change_events;

drop function if exists public.enforce_event_reference_tenant_integrity();

create or replace function public.enforce_intake_event_reference_tenant_integrity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ref_patient_id uuid;
  ref_medication_id uuid;
begin
  if new.supersedes_event_id is null then
    return new;
  end if;

  select e.patient_id, e.medication_id
    into ref_patient_id, ref_medication_id
  from public.intake_events e
  where e.id = new.supersedes_event_id;

  if ref_patient_id is null then
    raise exception 'superseded intake event not found';
  end if;
  if ref_patient_id <> new.patient_id or ref_medication_id <> new.medication_id then
    raise exception 'supersedes_event_id must reference the same patient and medication';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_medication_event_reference_tenant_integrity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ref_patient_id uuid;
  ref_medication_id uuid;
begin
  if new.reverses_event_id is null then
    return new;
  end if;

  select e.patient_id, e.medication_id
    into ref_patient_id, ref_medication_id
  from public.medication_change_events e
  where e.id = new.reverses_event_id;

  if ref_patient_id is null then
    raise exception 'reversed medication event not found';
  end if;
  if ref_patient_id <> new.patient_id or ref_medication_id <> new.medication_id then
    raise exception 'reverses_event_id must reference the same patient and medication';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_intake_event_reference_tenant_integrity() from public, anon, authenticated;
revoke all on function public.enforce_medication_event_reference_tenant_integrity() from public, anon, authenticated;

create trigger intake_events_reference_tenant_integrity
before insert on public.intake_events
for each row execute function public.enforce_intake_event_reference_tenant_integrity();

create trigger medication_change_events_reference_tenant_integrity
before insert on public.medication_change_events
for each row execute function public.enforce_medication_event_reference_tenant_integrity();
