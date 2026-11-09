import ScraperSchedule from '../models/ScraperSchedule.js';
import { pipelineError } from './execution.js';

const clock = minutes => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export function intervalSettings(hours, startAt) {
  if (!Number.isInteger(hours) || hours < 1 || hours > 168) throw pipelineError('Choose a whole interval from 1 to 168 hours.', 400);
  if (typeof startAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:00(?:\.000)?Z$/.test(startAt) || !Number.isFinite(Date.parse(startAt))) throw pipelineError('Choose a valid first run date and time.', 400);
  const normalized = new Date(startAt).toISOString();
  if (normalized.replace('.000Z', 'Z') !== startAt.replace('.000Z', 'Z')) throw pipelineError('Choose a valid first run date and time.', 400);
  return { mode: 'interval', hours, startAt: normalized, cron: `${new Date(startAt).getUTCMinutes()} * * * *` };
}

export function intervalSlot(schedule, now = Date.now()) {
  const anchor = Date.parse(schedule.startAt), period = schedule.hours * 3600000;
  if (now < anchor) return null;
  return Math.floor((now - anchor) / period);
}

export function nextIntervalRun(schedule, now = Date.now()) {
  const anchor = Date.parse(schedule.startAt), period = schedule.hours * 3600000;
  return new Date(anchor + Math.max(0, Math.ceil((now - anchor) / period)) * period).toISOString();
}

export function dailyCron(time) {
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw pipelineError('Choose a valid daily time in IST (HH:MM).', 400);
  const [hour, minute] = time.split(':').map(Number);
  const utc = (hour * 60 + minute - 330 + 1440) % 1440;
  return `${utc % 60} ${Math.floor(utc / 60)} * * *`;
}

// Only edit one daily schedule or our anchored interval; refuse unfamiliar YAML.
export function parseSchedule(source) {
  const block = source.match(/^  schedule:\r?\n((?:[ \t]{4,}[^\r\n]*\r?\n)+)/m);
  const interval = block?.[1].match(/^    - cron: '([^']+)' # jobverify-interval (\{[^\r\n]+\})\r?\n$/);
  if (interval) {
    try {
      const { hours, startAt } = JSON.parse(interval[2]);
      const settings = intervalSettings(hours, startAt);
      if (settings.cron !== interval[1]) throw new Error('Interval cron mismatch');
      return { block: block[0], ...settings };
    } catch { throw pipelineError('The saved interval schedule is invalid. Fix the workflow before editing.', 409); }
  }
  const entry = block?.[1].match(/^    - cron: (['"])(\d{1,2}) (\d{1,2}) \* \* \*\1(?:[ \t]*#[^\r\n]*)?\r?\n$/);
  if (!entry || Number(entry[2]) > 59 || Number(entry[3]) > 23) throw pipelineError('The workflow must have one daily UTC schedule or a supported interval to edit it here.', 409);
  return { block: block[0], mode: 'daily', cron: `${Number(entry[2])} ${Number(entry[3])} * * *`, time: clock((Number(entry[3]) * 60 + Number(entry[2]) + 330) % 1440) };
}

// Strictly after now: editing a schedule never starts a past occurrence.
export function nextScheduleRun(schedule, now = Date.now()) {
  if (schedule.mode === 'interval') return nextIntervalRun(schedule, now + 1);
  dailyCron(schedule.time);
  const [hour, minute] = schedule.time.split(':').map(Number);
  const offset = ((hour * 60 + minute - 330 + 1440) % 1440) * 60000;
  const candidate = Math.floor(now / 86400000) * 86400000 + offset;
  return new Date(candidate > now ? candidate : candidate + 86400000).toISOString();
}

export const scheduleView = row => ({
  mode: row.mode, ...(row.mode === 'daily' ? { time: row.time } : { hours: row.hours, startAt: row.startAt }),
  revision: row.revision, timezone: 'Asia/Kolkata', nextRunAt: new Date(row.nextRunAt).toISOString(),
  lastRunAt: row.lastRunAt ? new Date(row.lastRunAt).toISOString() : null,
  lastRunId: row.lastRunId || null, lastError: row.lastError || null,
});

export async function getScraperSchedule({ now = Date.now() } = {}) {
  const initial = { mode: 'daily', time: '08:30', revision: 0 };
  // The singleton primary key also serializes concurrent first startup.
  let row;
  try {
    row = await ScraperSchedule.findOneAndUpdate({ _id: 'global' }, { $setOnInsert: {
      ...initial, nextRunAt: new Date(nextScheduleRun(initial, now)),
    } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
  } catch (error) {
    if (error.code !== 11000) throw error;
    row = await ScraperSchedule.findById('global').lean();
  }
  return scheduleView(row);
}

export async function updateScraperSchedule({ mode = 'daily', time, hours, startAt, revision } = {}, { now = Date.now() } = {}) {
  if (!['daily', 'interval'].includes(mode)) throw pipelineError('Choose daily or interval scheduling.', 400);
  if (!Number.isSafeInteger(revision) || revision < 0) throw pipelineError('Reload the schedule before saving.', 400);
  let settings;
  if (mode === 'daily') { dailyCron(time); settings = { mode, time }; }
  else { const validated = intervalSettings(hours, startAt); settings = { mode, hours: validated.hours, startAt: validated.startAt }; }
  const current = await getScraperSchedule({ now });
  if (revision !== current.revision) throw pipelineError('The schedule changed. Reload the schedule and try again.', 409);
  const row = await ScraperSchedule.findOneAndUpdate({ _id: 'global', revision, leaseUntil: { $lte: new Date(now) } }, {
    $set: { ...settings, nextRunAt: new Date(nextScheduleRun(settings, now)), lastError: null },
    $unset: mode === 'daily' ? { hours: 1, startAt: 1 } : { time: 1 },
    $inc: { revision: 1 },
  }, { new: true, runValidators: true }).lean();
  if (!row) throw pipelineError('The schedule changed or a scheduled start is in progress. Reload and try again.', 409);
  return scheduleView(row);
}
