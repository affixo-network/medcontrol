create or replace function public.can_write_patient(target_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_patient_role(target_patient_id) in ('owner', 'admin', 'caregiver'), false)
$$;

create or replace function public.can_admin_patient(target_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_patient_role(target_patient_id) in ('owner', 'admin'), false)
$$;
