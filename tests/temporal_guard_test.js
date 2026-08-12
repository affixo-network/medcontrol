global.window = {};
const rules = require('../js/temporal-change-guard.js');
const assert = require('assert');

const med = { scheduleType:'daily', weekdays:[], explicitDates:[], startDate:'2026-08-12', endDate:'2026-08-20', times:['09:34'] };
const same = JSON.parse(JSON.stringify(med));
const scheduleChanged = { ...same, endDate:'2026-08-21' };
const timeChanged = { ...same, times:['10:00'] };
assert.strictEqual(rules.temporalScheduleChanged(med, same), false);
assert.strictEqual(rules.temporalScheduleChanged(med, scheduleChanged), true);
assert.strictEqual(rules.temporalTimeChanged(med, same), false);
assert.strictEqual(rules.temporalTimeChanged(med, timeChanged), true);
assert.strictEqual(rules.temporalLockMessage('schedule'), 'Для изменения Расписания вначале отмените Расписание в разделе «Приём препаратов».');
assert.strictEqual(rules.temporalLockMessage('time'), 'Для изменения времени приёма вначале отмените время приёма в разделе «Приём препаратов».');

const planned = Date.parse('2026-08-12T09:34:00Z');
assert.strictEqual(rules.computePendingSlotStatus(planned, Date.parse('2026-08-12T09:33:59Z')), 'expected');
assert.strictEqual(rules.computePendingSlotStatus(planned, Date.parse('2026-08-12T09:34:59Z')), 'expected');
assert.strictEqual(rules.computePendingSlotStatus(planned, Date.parse('2026-08-12T09:35:00Z')), 'overdue');
assert.strictEqual(rules.computeTakenTemporalStatus(planned, Date.parse('2026-08-12T09:33:30Z'), 'taken'), 'taken_early');
assert.strictEqual(rules.computeTakenTemporalStatus(planned, Date.parse('2026-08-12T09:34:45Z'), 'taken'), 'taken_on_time');
assert.strictEqual(rules.computeTakenTemporalStatus(planned, Date.parse('2026-08-12T09:39:00Z'), 'taken'), 'taken_late');
assert.strictEqual(rules.computeTakenTemporalStatus(planned, Date.parse('2026-08-12T09:39:00Z'), 'cancelled'), 'cancelled');
console.log('temporal_guard_test: PASS');
