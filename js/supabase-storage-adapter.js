/* Affixo MedControl — Supabase persistence adapter
 * Non-destructive bridge for modular UI. localStorage remains the immediate cache;
 * Supabase becomes the durable source once an authenticated session is available.
 */
(function () {
  'use strict';

  const LOCAL_KEY = 'affixo_medcontrol_standard_v3';
  const CONFIG = window.MEDCONTROL_SUPABASE || null;
  let client = null;
  let patientId = null;
  let syncPromise = Promise.resolve();

  function configured() {
    return !!(CONFIG && CONFIG.url && CONFIG.publishableKey && window.supabase?.createClient);
  }

  async function getClient() {
    if (!configured()) return null;
    if (!client) client = window.supabase.createClient(CONFIG.url, CONFIG.publishableKey);
    return client;
  }

  async function requireSession() {
    const sb = await getClient();
    if (!sb) return null;
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    return data.session || null;
  }

  async function ensurePatient(state) {
    if (patientId) return patientId;
    const sb = await getClient();
    const session = await requireSession();
    if (!sb || !session) return null;

    const { data: memberships, error } = await sb
      .from('patient_memberships')
      .select('patient_id,role,status,created_at')
      .eq('user_id', session.user.id)
      .eq('status', 'accepted')
      .order('created_at', { ascending: true })
      .limit(1);
    if (error) throw error;
    if (memberships?.length) {
      patientId = memberships[0].patient_id;
      return patientId;
    }

    const tz = state?.settings?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const { data: created, error: createError } = await sb.rpc('create_patient', {
      patient_name: 'MedControl',
      patient_timezone: tz
    });
    if (createError) throw createError;
    patientId = created;
    return patientId;
  }

  function normalizeMedication(med, order) {
    const times = Array.isArray(med.times) ? med.times :
      Array.isArray(med.scheduleTimes) ? med.scheduleTimes :
      Array.isArray(med.schedule?.times) ? med.schedule.times : [];
    return {
      medication_data: {
        legacyLocalId: String(med.id ?? med.localId ?? ''),
        name: String(med.name || med.details || 'Medication'),
        manufacturer: String(med.manufacturer || ''),
        contentValue: String(med.contentValue ?? med.content_value ?? 0),
        contentUnit: String(med.contentUnit || med.content_unit || 'unit'),
        contentUnitOther: String(med.contentUnitOther || ''),
        intakeQuantity: String(med.intakeQuantity ?? med.intake_quantity ?? 1),
        intakeUnit: String(med.intakeUnit || med.intake_unit || 'unit'),
        intakeUnitOther: String(med.intakeUnitOther || ''),
        details: String(med.details || med.name || 'Medication'),
        order: String(order),
        active: String(med.active !== false)
      },
      schedule_data: {
        scheduleType: med.scheduleType || med.schedule?.scheduleType || 'daily',
        weekdays: med.weekdays || med.schedule?.weekdays || [],
        explicitDates: med.explicitDates || med.schedule?.explicitDates || [],
        startDate: med.startDate || med.schedule?.startDate || new Date().toISOString().slice(0, 10),
        endDate: med.endDate || med.schedule?.endDate || '2099-12-31'
      },
      times: times.map(t => String(t).slice(0, 5)).filter(t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t))
    };
  }

  async function migrateMedications(state, pid) {
    const sb = await getClient();
    const meds = Array.isArray(state.medications) ? state.medications : [];
    if (!meds.length) return;
    const { data: existing, error } = await sb.from('medications').select('legacy_local_id').eq('patient_id', pid);
    if (error) throw error;
    const known = new Set((existing || []).map(x => x.legacy_local_id).filter(Boolean));

    for (let i = 0; i < meds.length; i++) {
      const normalized = normalizeMedication(meds[i], i);
      const legacyId = normalized.medication_data.legacyLocalId;
      if (!legacyId || known.has(legacyId) || !normalized.times.length) continue;
      const { error: createError } = await sb.rpc('create_medication_with_schedule', {
        target_patient_id: pid,
        medication_data: normalized.medication_data,
        schedule_data: normalized.schedule_data,
        schedule_times: normalized.times.map(t => `${t}:00`)
      });
      if (createError) throw createError;
      known.add(legacyId);
    }
  }

  async function sync(state) {
    const session = await requireSession();
    if (!session) return { synced: false, reason: configured() ? 'no-session' : 'not-configured' };
    const pid = await ensurePatient(state);
    if (!pid) return { synced: false, reason: 'no-patient' };
    await migrateMedications(state, pid);
    return { synced: true, patientId: pid };
  }

  function queueSync(state) {
    if (!configured()) return;
    const snapshot = JSON.parse(JSON.stringify(state));
    syncPromise = syncPromise.then(() => sync(snapshot)).catch(err => {
      console.error('MedControl Supabase sync failed; local cache preserved.', err);
    });
  }

  window.MedControlSupabaseStorage = {
    configured,
    sync,
    queueSync,
    localKey: LOCAL_KEY
  };
})();
