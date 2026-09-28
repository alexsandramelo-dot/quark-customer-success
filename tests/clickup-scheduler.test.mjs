import assert from 'node:assert/strict';
import {
  CLICKUP_SYNC_HOUR,
  CLICKUP_SYNC_TIME_ZONE,
  createDailyClickUpScheduler,
  hasSuccessfulSyncToday,
  localDayKey,
  nextScheduledTime,
  scheduledTimeForDay,
  shouldRunDailySync,
} from '../scripts/ingestion/clickup-scheduler.mjs';

assert.equal(CLICKUP_SYNC_TIME_ZONE, 'America/Sao_Paulo');
assert.equal(CLICKUP_SYNC_HOUR, 6);
assert.equal(scheduledTimeForDay(new Date('2026-09-27T08:59:00.000Z')).toISOString(), '2026-09-27T09:00:00.000Z');
assert.equal(nextScheduledTime(new Date('2026-09-27T09:00:00.000Z')).toISOString(), '2026-09-28T09:00:00.000Z');
assert.equal(localDayKey(new Date('2026-09-27T02:59:00.000Z')), '2026-09-26');

const beforeSix = new Date('2026-09-27T08:59:00.000Z');
const atSix = new Date('2026-09-27T09:00:00.000Z');
const attemptedYesterday = { clickupSync: { lastAttemptAt: '2026-09-27T02:30:00.000Z' } };
const manualToday = { clickupSync: { lastAttemptAt: '2026-09-27T14:00:00.000Z', lastAttemptResult: 'sucesso' } };
const failedToday = { clickupSync: { lastAttemptAt: '2026-09-27T14:00:00.000Z', lastAttemptResult: 'erro' } };
assert.equal(shouldRunDailySync({}, beforeSix), false, 'before 06:00 Sao Paulo, startup waits');
assert.equal(shouldRunDailySync({}, atSix), true, 'at 06:00 Sao Paulo, a missing daily attempt is due');
assert.equal(shouldRunDailySync(attemptedYesterday, atSix), true, 'a prior local day does not suppress today');
assert.equal(shouldRunDailySync(manualToday, atSix), false, 'a manual sync today suppresses the scheduled sync');
assert.equal(shouldRunDailySync(failedToday, atSix), true, 'a failed attempt is not considered a successful sync for today');
assert.equal(hasSuccessfulSyncToday({ clickupSync: { syncedAt: '2026-09-27T09:01:00.000Z' } }, atSix), true, 'legacy successful sync metadata remains recognized');

function fakeClock(initial) {
  let current = new Date(initial);
  let nextId = 0;
  const timers = new Map();
  return {
    now: () => new Date(current),
    setNow: (value) => { current = new Date(value); },
    setTimer: (callback, delay) => { const id = ++nextId; timers.set(id, { callback, delay }); return id; },
    clearTimer: (id) => timers.delete(id),
    takeTimer: () => { const [id, timer] = timers.entries().next().value ?? []; if (id !== undefined) timers.delete(id); return timer; },
    timerCount: () => timers.size,
  };
}

const waitForScheduler = () => new Promise((resolve) => setImmediate(resolve));

const clock = fakeClock(beforeSix);
let state = {};
let syncCount = 0;
const scheduledErrors = [];
const scheduler = createDailyClickUpScheduler({
  getState: async () => state,
  synchronize: async () => { syncCount += 1; state = { clickupSync: { lastAttemptAt: clock.now().toISOString(), lastAttemptResult: 'sucesso' } }; },
  now: clock.now,
  setTimer: clock.setTimer,
  clearTimer: clock.clearTimer,
  onError: (error) => scheduledErrors.push(error),
});
scheduler.start();
await waitForScheduler();
assert.equal(syncCount, 0, 'server startup before 06:00 does not synchronize immediately');
assert.equal(clock.takeTimer()?.delay, 60_000, 'server waits exactly until 06:00');

clock.setNow(atSix);
const morningScheduler = createDailyClickUpScheduler({
  getState: async () => state,
  synchronize: async () => { syncCount += 1; state = { clickupSync: { lastAttemptAt: clock.now().toISOString(), lastAttemptResult: 'sucesso' } }; },
  now: clock.now,
  setTimer: clock.setTimer,
  clearTimer: clock.clearTimer,
  onError: (error) => scheduledErrors.push(error),
});
morningScheduler.start();
await waitForScheduler();
assert.equal(syncCount, 1, 'server startup after 06:00 performs one missed daily sync');
assert.equal(clock.takeTimer()?.delay, 24 * 60 * 60 * 1000, 'after a due run, the next schedule is the following local day');

const restarted = createDailyClickUpScheduler({
  getState: async () => state,
  synchronize: async () => { syncCount += 1; },
  now: clock.now,
  setTimer: clock.setTimer,
  clearTimer: clock.clearTimer,
  onError: (error) => scheduledErrors.push(error),
});
restarted.start();
await waitForScheduler();
assert.equal(syncCount, 1, 'restart on the same day does not duplicate a completed sync');
assert.equal(clock.takeTimer()?.delay, 24 * 60 * 60 * 1000);

clock.setNow(new Date('2026-09-27T11:00:00.000Z'));
const manualSuccess = createDailyClickUpScheduler({
  getState: async () => ({ clickupSync: { syncedAt: '2026-09-27T10:45:00.000Z', lastAttemptResult: 'sucesso' } }),
  synchronize: async () => { syncCount += 1; },
  now: clock.now,
  setTimer: clock.setTimer,
  clearTimer: clock.clearTimer,
  onError: (error) => scheduledErrors.push(error),
});
manualSuccess.start();
await waitForScheduler();
assert.equal(syncCount, 1, 'server startup at 08:00 local skips after a successful manual sync that day');
assert.equal(clock.takeTimer()?.delay, 22 * 60 * 60 * 1000, 'after 08:00 the next schedule is 06:00 on the next local day');

const lateStartClock = fakeClock(new Date('2026-09-27T11:00:00.000Z'));
let lateStartCount = 0;
const lateStart = createDailyClickUpScheduler({
  getState: async () => ({}),
  synchronize: async () => { lateStartCount += 1; },
  now: lateStartClock.now,
  setTimer: lateStartClock.setTimer,
  clearTimer: lateStartClock.clearTimer,
  onError: (error) => scheduledErrors.push(error),
});
lateStart.start();
await waitForScheduler();
assert.equal(lateStartCount, 1, 'server startup at 08:00 local catches up if no successful sync exists today');
lateStart.stop();

clock.setNow(new Date('2026-09-28T09:00:00.000Z'));
const nextDay = createDailyClickUpScheduler({
  getState: async () => state,
  synchronize: async () => { syncCount += 1; state = { clickupSync: { lastAttemptAt: clock.now().toISOString(), lastAttemptResult: 'sucesso' } }; },
  now: clock.now,
  setTimer: clock.setTimer,
  clearTimer: clock.clearTimer,
  onError: (error) => scheduledErrors.push(error),
});
nextDay.start();
await waitForScheduler();
assert.equal(syncCount, 2, 'the next local calendar day receives its own daily sync');

const failureClock = fakeClock(atSix);
let failedState = {};
let failureCount = 0;
const failures = [];
const failedScheduler = createDailyClickUpScheduler({
  getState: async () => failedState,
  synchronize: async () => { failureCount += 1; failedState = { clickupSync: { lastAttemptAt: failureClock.now().toISOString(), lastAttemptResult: 'erro' } }; throw new Error('mock failure'); },
  now: failureClock.now,
  setTimer: failureClock.setTimer,
  clearTimer: failureClock.clearTimer,
  onError: (error) => failures.push(error.message),
});
failedScheduler.start();
await waitForScheduler();
assert.equal(failureCount, 1);
assert.deepEqual(failures, ['mock failure']);
const afterFailedRestart = createDailyClickUpScheduler({
  getState: async () => failedState,
  synchronize: async () => { failureCount += 1; failedState = { clickupSync: { lastAttemptAt: failureClock.now().toISOString(), lastAttemptResult: 'erro' } }; throw new Error('mock retry failure'); },
  now: failureClock.now,
  setTimer: failureClock.setTimer,
  clearTimer: failureClock.clearTimer,
  onError: (error) => failures.push(error.message),
});
afterFailedRestart.start();
await waitForScheduler();
assert.equal(failureCount, 2, 'a failed attempt does not count as the successful sync and may be retried after restart');
assert.deepEqual(failures, ['mock failure', 'mock retry failure'], 'scheduler records errors without throwing into the server process');

scheduler.stop();
morningScheduler.stop();
restarted.stop();
nextDay.stop();
failedScheduler.stop();
afterFailedRestart.stop();
manualSuccess.stop();
assert.equal(scheduledErrors.length, 0);

console.log('ClickUp daily scheduler tests passed: Sao Paulo 06:00, startup catch-up, local day rollover, manual/current attempt deduplication, restart and failure handling.');
