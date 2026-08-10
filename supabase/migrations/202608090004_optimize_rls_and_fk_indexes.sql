-- RLS init-plan optimization: evaluate auth.uid() once per statement.
alter policy profiles_select_self on public.profiles
  using (id = (select auth.uid()));

alter policy profiles_insert_self on public.profiles
  with check (id = (select auth.uid()));

alter policy profiles_update_self on public.profiles
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

alter policy memberships_insert_admin on public.patient_memberships
  with check (
    public.can_admin_patient(patient_id)
    and invited_by = (select auth.uid())
    and (role <> 'owner'::public.patient_role or public.current_patient_role(patient_id) = 'owner'::public.patient_role)
  );

alter policy medications_insert_writer on public.medications
  with check (
    public.can_write_patient(patient_id)
    and created_by = (select auth.uid())
  );

alter policy medication_change_events_insert_writer on public.medication_change_events
  with check (
    public.can_write_patient(patient_id)
    and actor_user_id = (select auth.uid())
  );

alter policy intake_events_insert_writer on public.intake_events
  with check (
    public.can_write_patient(patient_id)
    and actor_user_id = (select auth.uid())
  );

-- Cover foreign keys reported by the Supabase performance advisor.
create index if not exists intake_events_actor_user_id_idx
  on public.intake_events (actor_user_id);
create index if not exists intake_events_medication_id_idx
  on public.intake_events (medication_id);
create index if not exists intake_events_supersedes_event_id_idx
  on public.intake_events (supersedes_event_id);
create index if not exists medication_change_events_actor_user_id_idx
  on public.medication_change_events (actor_user_id);
create index if not exists medication_change_events_medication_id_idx
  on public.medication_change_events (medication_id);
create index if not exists medication_change_events_reverses_event_id_idx
  on public.medication_change_events (reverses_event_id);
create index if not exists medications_created_by_idx
  on public.medications (created_by);
create index if not exists patient_memberships_invited_by_idx
  on public.patient_memberships (invited_by);
create index if not exists patients_created_by_idx
  on public.patients (created_by);
