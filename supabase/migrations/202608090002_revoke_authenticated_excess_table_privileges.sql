-- MedControl Phase 2 least-privilege correction.
-- Keep the operation limited to excess table privileges inherited by authenticated.

revoke truncate, references, trigger on table
  public.profiles,
  public.patients,
  public.patient_memberships,
  public.medications,
  public.medication_schedules,
  public.medication_schedule_times,
  public.medication_change_events,
  public.intake_events
from authenticated;
