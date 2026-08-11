create or replace function public.record_taken_intake(
  target_patient_id uuid,
  target_medication_id uuid,
  target_planned_at timestamptz,
  target_actual_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_id uuid;
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.can_write_patient(target_patient_id) then
    raise exception 'Insufficient patient access';
  end if;
  if not exists (
    select 1 from public.medications m
    where m.id = target_medication_id and m.patient_id = target_patient_id
  ) then
    raise exception 'Medication does not belong to patient';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_patient_id::text || ':' || target_medication_id::text || ':' || target_planned_at::text, 0)
  );

  select e.id into existing_id
  from public.intake_events e
  where e.patient_id = target_patient_id
    and e.medication_id = target_medication_id
    and e.planned_at = target_planned_at
    and e.event_type = 'taken'
    and not exists (
      select 1 from public.intake_events s
      where s.supersedes_event_id = e.id
    )
  order by e.created_at desc
  limit 1;

  if existing_id is not null then
    return existing_id;
  end if;

  insert into public.intake_events(
    patient_id, medication_id, actor_user_id, event_type,
    planned_at, actual_at, status, metadata
  ) values (
    target_patient_id, target_medication_id, auth.uid(), 'taken',
    target_planned_at, target_actual_at, 'taken', '{}'::jsonb
  ) returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.record_taken_intake(uuid, uuid, timestamptz, timestamptz) from public;
revoke all on function public.record_taken_intake(uuid, uuid, timestamptz, timestamptz) from anon;
grant execute on function public.record_taken_intake(uuid, uuid, timestamptz, timestamptz) to authenticated;
