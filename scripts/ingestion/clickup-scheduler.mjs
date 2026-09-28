export const CLICKUP_SYNC_TIME_ZONE = 'America/Sao_Paulo';
export const CLICKUP_SYNC_HOUR = 6;

function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
}

export function localDayKey(date, timeZone = CLICKUP_SYNC_TIME_ZONE) {
  const parts = zonedParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function localTimeToUtc({ year, month, day, hour, minute = 0 }, timeZone) {
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = targetAsUtc;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const parts = zonedParts(new Date(candidate), timeZone);
    const representedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const adjustment = targetAsUtc - representedAsUtc;
    if (adjustment === 0) break;
    candidate += adjustment;
  }
  return new Date(candidate);
}

export function scheduledTimeForDay(date, { timeZone = CLICKUP_SYNC_TIME_ZONE, hour = CLICKUP_SYNC_HOUR } = {}) {
  const parts = zonedParts(date, timeZone);
  return localTimeToUtc({ year: parts.year, month: parts.month, day: parts.day, hour }, timeZone);
}

export function nextScheduledTime(date, options = {}) {
  const today = scheduledTimeForDay(date, options);
  if (today > date) return today;
  const parts = zonedParts(date, options.timeZone ?? CLICKUP_SYNC_TIME_ZONE);
  const tomorrow = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  const nextDate = { year: tomorrow.getUTCFullYear(), month: tomorrow.getUTCMonth() + 1, day: tomorrow.getUTCDate(), hour: options.hour ?? CLICKUP_SYNC_HOUR };
  return localTimeToUtc(nextDate, options.timeZone ?? CLICKUP_SYNC_TIME_ZONE);
}

export function hasSuccessfulSyncToday(state, date, timeZone = CLICKUP_SYNC_TIME_ZONE) {
  const sync = state?.clickupSync ?? {};
  const successfulAt = sync.syncedAt ?? (sync.lastAttemptResult === 'sucesso' ? sync.lastAttemptAt : null);
  return typeof successfulAt === 'string' && !Number.isNaN(Date.parse(successfulAt)) && localDayKey(new Date(successfulAt), timeZone) === localDayKey(date, timeZone);
}

export function shouldRunDailySync(state, date, options = {}) {
  const timeZone = options.timeZone ?? CLICKUP_SYNC_TIME_ZONE;
  const hour = options.hour ?? CLICKUP_SYNC_HOUR;
  return date >= scheduledTimeForDay(date, { timeZone, hour }) && !hasSuccessfulSyncToday(state, date, timeZone);
}

export function createDailyClickUpScheduler({
  getState,
  synchronize,
  now = () => new Date(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  onError = (error) => console.error('Falha no agendamento diário do ClickUp:', error),
  timeZone = CLICKUP_SYNC_TIME_ZONE,
  hour = CLICKUP_SYNC_HOUR,
} = {}) {
  if (typeof getState !== 'function' || typeof synchronize !== 'function') throw new TypeError('getState e synchronize são obrigatórios.');
  let timer = null;
  let started = false;
  let checking = false;

  const scheduleNext = () => {
    if (!started) return;
    if (timer !== null) clearTimer(timer);
    const current = now();
    const delay = Math.max(0, nextScheduledTime(current, { timeZone, hour }).getTime() - current.getTime());
    timer = setTimer(() => { timer = null; void checkAndSchedule(); }, delay);
  };

  const checkAndSchedule = async () => {
    if (!started || checking) return;
    checking = true;
    try {
      const current = now();
      const state = await getState();
      if (shouldRunDailySync(state, current, { timeZone, hour })) await synchronize();
    } catch (error) {
      onError(error);
    } finally {
      checking = false;
      scheduleNext();
    }
  };

  return {
    start() {
      if (started) return;
      started = true;
      void checkAndSchedule();
    },
    stop() {
      started = false;
      if (timer !== null) clearTimer(timer);
      timer = null;
    },
  };
}
