(function () {
  const TABLE = 'mc_cloud_snapshots';
  const STATE_VERSION = 'standard_v3';
  const SOURCE_VERSION = 'modular-2.000';
  let snapshotQueue = Promise.resolve();
  let snapshotTimer = null;

  function validState(state) {
    return !!state && typeof state === 'object' && !Array.isArray(state)
      && state.settings && typeof state.settings === 'object' && !Array.isArray(state.settings)
      && Array.isArray(state.medications) && Array.isArray(state.intakeLogs);
  }

  function meaningfulState(state) {
    return validState(state) && (state.medications.length > 0 || state.intakeLogs.length > 0);
  }

  async function createCloudSnapshot(options = {}) {
    const supabase = window.medcontrolSupabase;
    const user = window.medcontrolSupabaseUser;
    if (!supabase || !user?.id) return { ok: false, skipped: true, reason: 'auth_unavailable' };

    let state;
    try { state = options.state || getState(); }
    catch (error) { return { ok: false, skipped: true, reason: 'local_state_unreadable', error }; }

    if (!validState(state)) return { ok: false, skipped: true, reason: 'invalid_local_state' };
    if (!options.allowEmpty && !meaningfulState(state)) return { ok: false, skipped: true, reason: 'empty_local_state' };

    const { data: latest, error: latestError } = await supabase
      .from(TABLE).select('id,state,created_at').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (latestError) return { ok: false, reason: 'latest_snapshot_read_failed', error: latestError };

    const serialized = JSON.stringify(state);
    if (latest && JSON.stringify(latest.state) === serialized) return { ok: true, skipped: true, reason: 'unchanged', snapshot: latest };

    const { data, error } = await supabase.from(TABLE).insert({
      owner_user_id: user.id, state, state_version: STATE_VERSION, source_version: SOURCE_VERSION
    }).select('id,created_at').single();
    if (error) return { ok: false, reason: 'snapshot_insert_failed', error };
    return { ok: true, snapshot: data };
  }

  function queueCloudSnapshot(state) {
    const captured = state ? JSON.parse(JSON.stringify(state)) : null;
    snapshotQueue = snapshotQueue.then(() => createCloudSnapshot({ state: captured })).catch(error => {
      console.error('MedControl cloud snapshot failed.', error);
      return { ok: false, reason: 'snapshot_exception', error };
    });
    return snapshotQueue;
  }

  function scheduleCloudSnapshot(state) {
    const captured = state ? JSON.parse(JSON.stringify(state)) : null;
    if (snapshotTimer) clearTimeout(snapshotTimer);
    snapshotTimer = setTimeout(() => { snapshotTimer = null; queueCloudSnapshot(captured); }, 300);
  }

  async function getLatestCloudSnapshot() {
    const supabase = window.medcontrolSupabase;
    if (!supabase || !window.medcontrolSupabaseUser?.id) return { ok: false, reason: 'auth_unavailable' };
    const { data, error } = await supabase.from(TABLE)
      .select('id,state,state_version,source_version,created_at').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) return { ok: false, reason: 'snapshot_read_failed', error };
    if (!data) return { ok: true, snapshot: null };
    if (!validState(data.state)) return { ok: false, reason: 'invalid_cloud_snapshot' };
    return { ok: true, snapshot: data };
  }

  async function restoreLatestCloudSnapshot(options = {}) {
    const result = await getLatestCloudSnapshot();
    if (!result.ok || !result.snapshot) return result;
    let currentRaw = null;
    try { currentRaw = localStorage.getItem(STORAGE_KEY); }
    catch (error) { return { ok: false, reason: 'local_read_failed', error }; }
    if (currentRaw && !options.overwriteExisting) return { ok: false, reason: 'local_state_exists', snapshot: result.snapshot };

    const restoreSafetyKey = `${STORAGE_KEY}_before_cloud_restore_${Date.now()}`;
    try {
      if (currentRaw) localStorage.setItem(restoreSafetyKey, currentRaw);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result.snapshot.state));
      const verify = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!validState(verify)) throw new Error('Cloud restore verification failed');
    } catch (error) {
      try { if (currentRaw !== null) localStorage.setItem(STORAGE_KEY, currentRaw); } catch (_) {}
      return { ok: false, reason: 'local_restore_failed', error, restoreSafetyKey };
    }
    return { ok: true, snapshot: result.snapshot, restoreSafetyKey: currentRaw ? restoreSafetyKey : null };
  }

  const inheritedSaveState = window.saveState;
  if (typeof inheritedSaveState === 'function') {
    window.saveState = function(state, options) {
      const saved = inheritedSaveState(state, options);
      if (saved) scheduleCloudSnapshot(state);
      return saved;
    };
  }

  window.medcontrolCloudSnapshot = {
    create: createCloudSnapshot, queue: queueCloudSnapshot, schedule: scheduleCloudSnapshot,
    latest: getLatestCloudSnapshot, restoreLatest: restoreLatestCloudSnapshot,
    validState, meaningfulState
  };

  setTimeout(() => queueCloudSnapshot(), 0);
})();
