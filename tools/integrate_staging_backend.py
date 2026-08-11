from pathlib import Path
import re
import subprocess

BRANCH = "origin/staging-supabase-sync"
ROOT = Path(__file__).resolve().parents[1]


def replace_between(text: str, start: str, end: str, replacement: str) -> str:
    a = text.find(start)
    if a < 0:
        raise RuntimeError(f"start marker not found: {start}")
    b = text.find(end, a)
    if b < 0:
        raise RuntimeError(f"end marker not found: {end}")
    return text[:a] + replacement.rstrip() + "\n" + text[b:]


def git_show(path: str) -> str:
    return subprocess.check_output(["git", "show", f"{BRANCH}:{path}"], text=True)


def copy_staging_files():
    paths = ["supabase-config.js"] + [
        f"supabase/migrations/2026080900{i:02d}_{name}"
        for i, name in [
            (1, "phase2_medcontrol_schema.sql"),
            (2, "revoke_authenticated_excess_table_privileges.sql"),
            (3, "restrict_rls_auto_enable_execute.sql"),
            (4, "optimize_rls_and_fk_indexes.sql"),
            (5, "fix_generic_identity_trigger.sql"),
            (6, "revoke_trigger_helper_execute.sql"),
            (7, "normalize_authorization_helpers_boolean.sql"),
            (8, "record_taken_intake_atomic.sql"),
            (9, "enforce_event_reference_tenant_integrity.sql"),
            (10, "split_event_reference_integrity_triggers.sql"),
        ]
    ]
    for path in paths:
        target = ROOT / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(git_show(path), encoding="utf-8")


def patch_auth_page(path: Path):
    text = path.read_text(encoding="utf-8")
    old = '''import { createClient } from "https://esm.sh/@supabase/supabase-js@2";\n\nconst SUPABASE_URL = "https://lewdbjjaohqxbirzhrbm.supabase.co";\nconst SUPABASE_ANON_KEY = "sb_publishable_AKV7EBBgChuoMpGJlwxwig_OYo4bzKZ";\nconst supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);'''
    new = '''import { createClient } from "https://esm.sh/@supabase/supabase-js@2";\nimport { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";\nconst supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);'''
    if old not in text:
        raise RuntimeError(f"Supabase constants not found in {path}")
    path.write_text(text.replace(old, new), encoding="utf-8")


def patch_app():
    path = ROOT / "app.html"
    text = path.read_text(encoding="utf-8")

    old_client = '''import { createClient } from "https://esm.sh/@supabase/supabase-js@2";\n\nconst SUPABASE_URL = "https://lewdbjjaohqxbirzhrbm.supabase.co";\nconst SUPABASE_ANON_KEY = "sb_publishable_AKV7EBBgChuoMpGJlwxwig_OYo4bzKZ";\nconst supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);'''
    new_client = '''import { createClient } from "https://esm.sh/@supabase/supabase-js@2";\nimport { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";\nconst supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);'''
    if old_client not in text:
        raise RuntimeError("old Supabase client block not found")
    text = text.replace(old_client, new_client)

    old_fields = '''          <input id="medName" placeholder="Medication name" />\n          <input id="doseValue" placeholder="Value" style="width:90px;" />\n          <select id="doseUnit" style="min-width:140px;"></select>\n          <input id="doseCustom" placeholder="Custom dose" style="display:none;min-width:180px;" />\n          <input id="medSlots" />'''
    new_fields = '''          <input id="medName" placeholder="Medication name" />\n          <input id="contentValue" type="number" min="0" step="any" placeholder="Content" style="width:90px;" />\n          <select id="contentUnit" style="min-width:105px;">\n            <option value="mg">mg</option><option value="mcg">mcg</option><option value="g">g</option>\n            <option value="ml">ml</option><option value="IU">IU</option><option value="unit">unit</option>\n          </select>\n          <input id="doseValue" type="number" min="0" step="any" placeholder="Intake" style="width:90px;" />\n          <select id="doseUnit" style="min-width:140px;"></select>\n          <input id="doseCustom" placeholder="Custom intake unit" style="display:none;min-width:180px;" />\n          <input id="medSlots" />'''
    if old_fields not in text:
        raise RuntimeError("medication input fields block not found")
    text = text.replace(old_fields, new_fields)

    text = text.replace('let currentLang = "en";', 'let currentLang = "en";\nlet selectedPatientTimezone = "UTC";\nlet selectedRole = null;\nconst intakeInFlight = new Set();')

    helpers = r'''
function patientToday() {
  const p = zonedNowParts(selectedPatientTimezone || currentTimezone || "UTC");
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: selectedPatientTimezone || currentTimezone || "UTC", weekday: "short" }).format(new Date());
  return { date: `${p.year}-${String(p.month).padStart(2,"0")}-${String(p.day).padStart(2,"0")}`, weekday, timeZone: selectedPatientTimezone || currentTimezone || "UTC" };
}
function scheduleRunsToday(s, today) {
  if (s.schedule_type === "daily") return (!s.start_date || today.date >= s.start_date) && (!s.end_date || today.date <= s.end_date);
  if (s.schedule_type === "weekdays") return (!s.start_date || today.date >= s.start_date) && (!s.end_date || today.date <= s.end_date) && (s.weekdays || []).includes(today.weekday);
  if (s.schedule_type === "explicit_dates") return (s.explicit_dates || []).includes(today.date);
  return false;
}
function plannedIsoFor(dateText, slot) {
  const [y,m,d] = dateText.split("-").map(Number);
  const [hh,mm] = slot.split(":").map(Number);
  return new Date(zonedDateTimeToUtcMs(selectedPatientTimezone || currentTimezone || "UTC", y,m,d,hh,mm,0)).toISOString();
}
function medicationDoseLabel(m) {
  const intakeUnit = m.intake_unit === "other" ? m.intake_unit_other : m.intake_unit;
  const contentUnit = m.content_unit === "other" ? m.content_unit_other : m.content_unit;
  return `${m.intake_quantity ?? ""} ${intakeUnit || ""} (${m.content_value ?? ""} ${contentUnit || ""})`.trim();
}
async function effectiveTakenEvent(medicationId, plannedAt) {
  const { data, error } = await supabase.from("intake_events")
    .select("id,event_type,supersedes_event_id,created_at")
    .eq("patient_id", selectedPatientId).eq("medication_id", medicationId).eq("planned_at", plannedAt)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = data || [];
  const superseded = new Set(rows.map(x => x.supersedes_event_id).filter(Boolean));
  return rows.find(x => x.event_type === "taken" && !superseded.has(x.id)) || null;
}
'''
    insert_marker = 'function computeRecordedStatus(slotMs, nextSlotMs, log) {'
    pos = text.find(insert_marker)
    if pos < 0:
        raise RuntimeError("helper insertion marker missing")
    text = text[:pos] + helpers + "\n" + text[pos:]

    text = replace_between(text, 'async function renderSelectedHeader() {', 'async function loadProfile() {', r'''
async function renderSelectedHeader() {
  if (!selectedPatientId) { selectedEl.textContent = t("selected_none"); return; }
  selectedEl.innerHTML = `${t("selected_prefix")} <strong>${escapeHtml(currentPatientName)}</strong><br><br>${escapeHtml(selectedRole || t("role_unknown"))}`;
}
''')

    text = replace_between(text, 'async function loadProfile() {', 'async function fetchPatients() {', r'''
async function loadProfile() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData?.session) {
    statusEl.textContent = t("no_session");
    window.location.replace("./auth-login.html");
    throw new Error("No session");
  }
  currentUserId = sessionData.session.user.id;
  profileEmail = sessionData.session.user.email || "(no email)";
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("id,display_name,interface_language,country,timezone").eq("id", currentUserId).maybeSingle();
  if (profileError) throw profileError;
  const safe = profile || {};
  currentCountry = (safe.country || "AM").toUpperCase();
  const countryConfig = COUNTRY_CONFIG[currentCountry] || COUNTRY_CONFIG.AM;
  currentTimezone = safe.timezone || browserTz;
  setLanguage(normalizeLang(safe.interface_language || countryConfig.lang || "en"), true);
  applyTexts();
  tzLabelEl.textContent = currentTimezone;
  countryLabelEl.textContent = countryConfig.countryName;
  startLocalClock();
  statusEl.textContent = `${t("logged_in_as")} ${profileEmail}`;
  addMedSectionEl.style.display = "block";
  await supabase.from("profiles").upsert({ id: currentUserId, timezone: currentTimezone }, { onConflict: "id" });
}
''')

    text = replace_between(text, 'async function fetchPatients() {', 'async function renderPatientsList(patients) {', r'''
async function fetchPatients() {
  errEl.textContent = "";
  const { data, error } = await supabase.from("patients")
    .select("id,display_name,timezone,created_at").order("created_at", { ascending:false });
  if (error) { errEl.textContent = t("patients_error") + error.message; return []; }
  return data || [];
}
''')

    text = replace_between(text, 'async function renderPatientsList(patients) {', 'async function selectPatient(', r'''
async function renderPatientsList(patients) {
  patientsEl.innerHTML = "";
  if (!patients.length) { patientsEl.innerHTML = `<li>${escapeHtml(t("no_patients"))}</li>`; return; }
  patients.forEach((p) => {
    const li = document.createElement("li");
    li.className = selectedPatientId === p.id ? "active" : "";
    li.textContent = `${p.display_name} — ${p.timezone || "UTC"}`;
    li.onclick = async () => selectPatient(p.id, p.display_name, p.timezone || "UTC");
    patientsEl.appendChild(li);
  });
}
''')

    text = replace_between(text, 'async function selectPatient(', 'async function loadMeds() {', r'''
async function selectPatient(patientId, displayName, patientTimezone = "UTC") {
  selectedPatientId = patientId;
  currentPatientName = displayName;
  selectedPatientTimezone = patientTimezone || "UTC";
  const { data: membership, error } = await supabase.from("patient_memberships")
    .select("role,status").eq("patient_id", patientId).eq("user_id", currentUserId).eq("status","accepted").maybeSingle();
  if (error) throw error;
  selectedRole = membership?.role || null;
  role = selectedRole || "unknown";
  await renderSelectedHeader();
  applyTexts();
  await loadMeds();
  await loadToday();
  await loadHistory();
  await loadTeamMembers();
}
''')

    text = replace_between(text, 'async function loadMeds() {', 'async function mark(', r'''
async function loadMeds() {
  medsEl.innerHTML = "";
  if (!selectedPatientId) return;
  const { data, error } = await supabase.from("medications")
    .select("id,name,content_value,content_unit,content_unit_other,intake_quantity,intake_unit,intake_unit_other,active,cancelled,created_at")
    .eq("patient_id", selectedPatientId).order("created_at", { ascending:false });
  if (error) { medsEl.innerHTML = `<li>${escapeHtml(t("meds_error") + error.message)}</li>`; return; }
  if (!data?.length) { medsEl.innerHTML = `<li>${escapeHtml(t("no_meds"))}</li>`; return; }
  data.forEach((m) => {
    const li = document.createElement("li");
    li.textContent = `${m.name} — ${medicationDoseLabel(m)}${m.cancelled ? " — cancelled" : ""}`;
    medsEl.appendChild(li);
  });
}
''')

    text = replace_between(text, 'async function mark(', 'async function loadToday() {', r'''
async function mark(medicationId, slotLabel, action) {
  if (!selectedPatientId) return;
  const today = patientToday();
  const plannedAt = plannedIsoFor(today.date, slotLabel);
  const key = `${selectedPatientId}:${medicationId}:${plannedAt}`;
  if (intakeInFlight.has(key)) return;
  intakeInFlight.add(key);
  try {
    if (action === "taken") {
      const { error } = await supabase.rpc("record_taken_intake", {
        target_patient_id: selectedPatientId,
        target_medication_id: medicationId,
        target_planned_at: plannedAt,
        target_actual_at: new Date().toISOString()
      });
      if (error) throw error;
    } else if (action === "cancelled") {
      const prior = await effectiveTakenEvent(medicationId, plannedAt);
      if (!prior) return;
      const { error } = await supabase.from("intake_events").insert({
        patient_id:selectedPatientId, medication_id:medicationId, event_type:"cancelled",
        planned_at:plannedAt, actual_at:new Date().toISOString(), status:"cancelled",
        supersedes_event_id:prior.id
      });
      if (error) throw error;
    }
    await Promise.all([loadToday(), loadHistory()]);
  } catch (e) { alert(t("today_error") + (e?.message || e)); }
  finally { intakeInFlight.delete(key); }
}
async function clearMark(medicationId, slotLabel) {
  if (!selectedPatientId) return;
  const today = patientToday();
  const plannedAt = plannedIsoFor(today.date, slotLabel);
  try {
    const prior = await effectiveTakenEvent(medicationId, plannedAt);
    if (!prior) return;
    const { error } = await supabase.from("intake_events").insert({
      patient_id:selectedPatientId, medication_id:medicationId, event_type:"reversal",
      planned_at:plannedAt, actual_at:new Date().toISOString(), status:"reversed",
      supersedes_event_id:prior.id
    });
    if (error) throw error;
    await Promise.all([loadToday(), loadHistory()]);
  } catch (e) { alert(t("today_error") + (e?.message || e)); }
}
''')

    text = replace_between(text, 'async function loadToday() {', 'async function loadHistory() {', r'''
async function loadToday() {
  todayEl.innerHTML = "";
  if (!selectedPatientId) return;
  const today = patientToday();
  const nowMs = Date.now();
  const { data: meds, error: medsErr } = await supabase.from("medications")
    .select("id,name,content_value,content_unit,content_unit_other,intake_quantity,intake_unit,intake_unit_other")
    .eq("patient_id", selectedPatientId).eq("active", true).eq("cancelled", false);
  if (medsErr) { todayEl.textContent = t("today_error") + medsErr.message; return; }
  if (!meds?.length) { todayEl.textContent = t("no_meds"); return; }
  const { data: schedules, error: schErr } = await supabase.from("medication_schedules")
    .select("id,medication_id,schedule_type,weekdays,explicit_dates,start_date,end_date")
    .eq("patient_id", selectedPatientId);
  if (schErr) { todayEl.textContent = t("today_error") + schErr.message; return; }
  const activeSchedules = (schedules || []).filter(s => scheduleRunsToday(s, today));
  const ids = activeSchedules.map(s => s.id);
  let times = [];
  if (ids.length) {
    const r = await supabase.from("medication_schedule_times").select("schedule_id,time_of_day")
      .eq("patient_id", selectedPatientId).in("schedule_id", ids).order("time_of_day");
    if (r.error) { todayEl.textContent = t("today_error") + r.error.message; return; }
    times = r.data || [];
  }
  const medById = new Map(meds.map(m => [m.id,m]));
  const schById = new Map(activeSchedules.map(s => [s.id,s]));
  const grouped = new Map();
  for (const row of times) {
    const s = schById.get(row.schedule_id); const med = s && medById.get(s.medication_id); if (!med) continue;
    const slot = String(row.time_of_day).slice(0,5);
    const arr = grouped.get(med.id) || []; arr.push(slot); grouped.set(med.id,arr);
  }
  for (const med of meds) {
    const slots = (grouped.get(med.id) || []).sort();
    if (!slots.length) continue;
    const block = document.createElement("div"); block.className="row-card"; block.style.padding="12px"; block.style.marginBottom="12px";
    block.innerHTML = `<div><strong>${escapeHtml(med.name)}</strong> — ${escapeHtml(medicationDoseLabel(med))}</div>`;
    for (let idx=0; idx<slots.length; idx++) {
      const slot=slots[idx], plannedAt=plannedIsoFor(today.date,slot), slotMs=new Date(plannedAt).getTime();
      const nextSlotMs = idx < slots.length-1 ? new Date(plannedIsoFor(today.date,slots[idx+1])).getTime() : getZonedDayRange(today.timeZone).nextStartMs;
      const existing = await effectiveTakenEvent(med.id, plannedAt);
      const liveStatus = existing ? computeRecordedStatus(slotMs,nextSlotMs,{status:"taken",created_at:existing.created_at,scheduled_at:plannedAt}) : computeLiveStatus(slotMs,nextSlotMs,false,idx===slots.length-1,nowMs);
      const row=document.createElement("div"); row.className="slot";
      row.innerHTML=`<div class="slot-head"><div><strong>${escapeHtml(slot)}</strong> <span class="muted">— ${escapeHtml(t("status_label"))}: <span class="status-chip">${escapeHtml(liveStatus)}</span></span></div></div><div class="inline" style="margin-top:8px;">${existing ? `<button data-act="cancel">${escapeHtml(t("cancel"))}</button><button data-act="clear">${escapeHtml(t("correct"))}</button>` : `<button data-act="taken">${escapeHtml(t("taken"))}</button>`}</div>`;
      if (existing) { row.querySelector('[data-act="cancel"]').onclick=()=>mark(med.id,slot,"cancelled"); row.querySelector('[data-act="clear"]').onclick=()=>clearMark(med.id,slot); }
      else row.querySelector('[data-act="taken"]').onclick=()=>mark(med.id,slot,"taken");
      block.appendChild(row);
    }
    todayEl.appendChild(block);
  }
  if (!todayEl.children.length) todayEl.textContent = "No active schedule times today.";
}
''')

    text = replace_between(text, 'async function loadHistory() {', 'async function loadTeamMembers() {', r'''
async function loadHistory() {
  historyEl.innerHTML="";
  if (!selectedPatientId) return;
  const since = new Date(Date.now()-7*24*60*60*1000).toISOString();
  const { data, error } = await supabase.from("intake_events")
    .select("event_type,planned_at,actual_at,status,actor_user_id,created_at,medication_id,supersedes_event_id")
    .eq("patient_id", selectedPatientId).gte("created_at",since).order("created_at",{ascending:false}).limit(100);
  if (error) { historyEl.textContent=t("history_error")+error.message; return; }
  if (!data?.length) { historyEl.textContent=t("no_history"); return; }
  data.forEach(r => {
    const item=document.createElement("div"); item.className="history-item";
    const actualText=formatInTimeZone(r.actual_at || r.created_at, selectedPatientTimezone);
    const plannedText=formatInTimeZone(r.planned_at, selectedPatientTimezone).split(" ").pop();
    const actor = r.actor_user_id === currentUserId ? profileEmail : String(r.actor_user_id || "").slice(0,8);
    item.innerHTML=`<div><strong>${escapeHtml(r.event_type)}</strong> — ${escapeHtml(actualText)}${actor ? ` — ${escapeHtml(actor)}` : ""}</div><div class="small muted">${escapeHtml(t("planned_slot"))}: ${escapeHtml(plannedText)}</div>`;
    historyEl.appendChild(item);
  });
}
''')

    text = replace_between(text, 'async function loadTeamMembers() {', 'document.getElementById("addMed").onclick = async () => {', r'''
async function loadTeamMembers() {
  teamMembersListEl.innerHTML=""; teamInviteStatusEl.textContent="";
  if (!selectedPatientId) return;
  const { data: members, error } = await supabase.from("patient_memberships")
    .select("user_id,role,status,invited_email,created_at").eq("patient_id",selectedPatientId).order("created_at",{ascending:true});
  if (error) { teamMembersListEl.innerHTML=`<li>${escapeHtml(t("team_list_error")+error.message)}</li>`; return; }
  const rows=members||[]; currentMode = rows.filter(x=>x.status==="accepted").length > 1 || rows.some(x=>x.status==="invited") ? "team" : "standard"; updateModeUI(currentMode);
  if (!rows.length) teamMembersListEl.innerHTML=`<li>${escapeHtml(t("no_team_members"))}</li>`;
  rows.forEach(m=>{ const li=document.createElement("li"); li.textContent=`${m.invited_email || (m.user_id ? m.user_id.slice(0,8) : "member")} — ${m.role} — ${m.status}`; teamMembersListEl.appendChild(li); });
}
addTeamMemberBtn.onclick = async () => {
  if (!selectedPatientId) { teamEmailStatusEl.textContent=t("select_patient_first"); return; }
  if (!['owner','admin'].includes(selectedRole)) { teamEmailStatusEl.textContent='Only owner/admin can invite members'; return; }
  const email=String(teamEmailEl.value||"").trim().toLowerCase(); if(!email){teamEmailStatusEl.textContent=t("enter_team_email");return;}
  const { error } = await supabase.from("patient_memberships").insert({patient_id:selectedPatientId,user_id:null,role:'caregiver',status:'invited',invited_email:email,invited_by:currentUserId});
  if(error){teamEmailStatusEl.textContent=t("invite_save_error")+error.message;return;}
  teamEmailEl.value=""; teamEmailStatusEl.textContent=t("team_added"); await loadTeamMembers();
};
''')

    text = replace_between(text, 'document.getElementById("addMed").onclick = async () => {', 'document.getElementById("whoami").onclick = async () => {', r'''
document.getElementById("addMed").onclick = async () => {
  if (!selectedPatientId) { alert(t("select_patient_first")); return; }
  if (!['owner','admin','caregiver'].includes(selectedRole)) { alert('Write access denied for this role'); return; }
  const name=document.getElementById("medName").value.trim();
  const contentRaw=document.getElementById("contentValue").value.trim();
  const contentValue=Number(contentRaw); const contentUnit=document.getElementById("contentUnit").value || 'mg';
  const intakeRaw=document.getElementById("doseValue").value.trim(); const intakeQuantity=Number(intakeRaw);
  const doseUnit=document.getElementById("doseUnit").value; const doseCustom=document.getElementById("doseCustom").value.trim();
  const intakeUnit=doseUnit==='custom' ? 'other' : doseUnit; const intakeUnitOther=doseUnit==='custom' ? doseCustom : '';
  const slots=parseSlotList(document.getElementById("medSlots").value.trim());
  if(!name){alert(t("enter_med_name"));return;}
  if(!contentRaw || !Number.isFinite(contentValue) || contentValue<0){alert('Medication content must be a finite non-negative number');return;}
  if(!intakeRaw || !Number.isFinite(intakeQuantity) || intakeQuantity<0){alert('Intake quantity must be a finite non-negative number');return;}
  if(!intakeUnit || (intakeUnit==='other' && !intakeUnitOther)){alert('Select intake unit');return;}
  if(!slots.length){alert(t("enter_med_slots"));return;} if(!slots.every(isValidHHMM)){alert(t("bad_time_list"));return;}
  const today=patientToday(), start=today.date; const endDate=new Date(`${start}T00:00:00Z`); endDate.setUTCDate(endDate.getUTCDate()+365); const end=endDate.toISOString().slice(0,10);
  const medication_data={name,manufacturer:'',contentValue:String(contentValue),contentUnit,contentUnitOther:'',intakeQuantity:String(intakeQuantity),intakeUnit,intakeUnitOther,details:name,order:'0',active:'true'};
  const schedule_data={scheduleType:'daily',weekdays:[],explicitDates:[],startDate:start,endDate:end};
  const { error } = await supabase.rpc('create_medication_with_schedule',{target_patient_id:selectedPatientId,medication_data,schedule_data,schedule_times:slots.map(x=>`${x}:00`)});
  if(error){alert(t("cannot_add_med")+error.message);return;}
  ['medName','contentValue','doseValue','doseCustom','medSlots'].forEach(id=>document.getElementById(id).value=''); document.getElementById('doseUnit').value=''; doseCustomEl.style.display='none';
  await Promise.all([loadMeds(),loadToday(),loadHistory()]);
};
''')

    text = replace_between(text, 'document.getElementById("whoami").onclick = async () => {', 'document.getElementById("logout").onclick = async () => {', r'''
document.getElementById("whoami").onclick = async () => {
  const { data } = await supabase.auth.getSession();
  alert(JSON.stringify({user_id:data?.session?.user?.id || null,email:data?.session?.user?.email || null,patient_role:selectedRole},null,2));
};
''')

    text = text.replace('window.location.replace("/auth-login.html");', 'window.location.replace("./auth-login.html");')
    text = text.replace('await selectPatient(p.id, p.display_name, p.monitoring_mode || "standard");', 'await selectPatient(p.id, p.display_name, p.timezone || "UTC");')

    path.write_text(text, encoding="utf-8")


def main():
    copy_staging_files()
    patch_auth_page(ROOT / "auth-login.html")
    patch_auth_page(ROOT / "settings.html")
    patch_app()


if __name__ == "__main__":
    main()
