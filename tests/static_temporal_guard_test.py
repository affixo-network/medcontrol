from pathlib import Path
root = Path(__file__).resolve().parents[1]
render = (root/'js/render.js').read_text(encoding='utf-8')
meds = (root/'js/medications.js').read_text(encoding='utf-8')
intake = (root/'js/intake.js').read_text(encoding='utf-8')
for text in ['Отменить Расписание','Отменить Время','temporalCancellationDialog','temporalPendingNoticeHtml()']:
    assert text in render, text
for text in ['validateTemporalEditAuthorization','completeTemporalEdit','temporal_schedule_locked','temporal_time_locked']:
    assert text in meds, text
assert 'DEFAULT_GRACE_MINUTES * 60 * 1000' not in intake
assert "computePendingSlotStatus(plannedMs, now)" in intake
for page in ['input.html','action.html']:
    assert 'js/auth-guard.js' in (root/page).read_text(encoding='utf-8')
    dependencies = (root/'js/auth-guard.js').read_text(encoding='utf-8').split(page.removesuffix('.html')+':[', 1)[1].split('],', 1)[0]
    assert 'js/temporal-change-guard.js' in dependencies
print('static_temporal_guard_test: PASS')
