create or replace function public.enforce_tenant_identity_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.patient_id is distinct from old.patient_id then
    raise exception 'patient_id is immutable';
  end if;

  if tg_table_name = 'medications' then
    if new.created_by is distinct from old.created_by then
      raise exception 'created_by is immutable';
    end if;
    if new.legacy_local_id is distinct from old.legacy_local_id then
      raise exception 'legacy_local_id is immutable';
    end if;
  elsif tg_table_name = 'medication_schedules' then
    if new.medication_id is distinct from old.medication_id then
      raise exception 'medication_id is immutable';
    end if;
  elsif tg_table_name = 'medication_schedule_times' then
    if new.schedule_id is distinct from old.schedule_id then
      raise exception 'schedule_id is immutable';
    end if;
  end if;

  return new;
end
$$;
