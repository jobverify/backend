const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const IST_OFFSET_MS = 330 * MINUTE_MS;

export function validateBroadcastWindow({ startTime = '', endTime = '' } = {}) {
  if (startTime === '' && endTime === '') return { startTime, endTime };
  if (typeof startTime !== 'string' || typeof endTime !== 'string'
    || startTime.length !== 5 || endTime.length !== 5 || !TIME.test(startTime) || !TIME.test(endTime)) {
    throw Object.assign(new Error('Choose both a valid start time and end time (HH:mm, IST), or leave both blank.'), { status: 400 });
  }
  if (startTime === endTime) {
    throw Object.assign(new Error('Start time and end time must be different. Leave both blank for all-day posting.'), { status: 400 });
  }
  return { startTime, endTime };
}

export function validatePostingWindows(settings = {}) {
  if (settings.postingWindows === undefined) {
    const slot = validateBroadcastWindow(settings);
    return slot.startTime ? [slot] : [];
  }
  if (!Array.isArray(settings.postingWindows) || settings.postingWindows.length > 24) {
    throw Object.assign(new Error('Provide up to 24 posting time slots.'), { status: 400 });
  }
  return settings.postingWindows.map(slot => {
    if (!slot || typeof slot !== 'object' || Array.isArray(slot)
      || Object.keys(slot).some(key => !['startTime', 'endTime'].includes(key))) {
      throw Object.assign(new Error('Provide a start time and end time for each slot.'), { status: 400 });
    }
    const validated = validateBroadcastWindow(slot);
    if (!validated.startTime) throw Object.assign(new Error('Choose both a start time and an end time for every slot.'), { status: 400 });
    return validated;
  });
}

const timeMs = time => {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours * 60 + minutes) * MINUTE_MS;
};

// IST has a fixed offset; calculate against its calendar day, independent of
// the worker host timezone. A window may span midnight. End is exclusive.
export function nextBroadcastWindowAt(date, settings) {
  if (date == null) return null;
  const slots = validatePostingWindows(settings);
  const timestamp = new Date(date).getTime();
  // Records created before slot scheduling retain their legacy all-day mode.
  // An explicitly saved empty list, however, never permits a post.
  if (!slots.length) return settings?.postingWindows === undefined ? new Date(timestamp) : null;
  const local = timestamp + IST_OFFSET_MS;
  const dayStart = Math.floor(local / DAY_MS) * DAY_MS;
  const time = local - dayStart;
  let earliest = Infinity;
  for (const { startTime, endTime } of slots) {
    const start = timeMs(startTime);
    const end = timeMs(endTime);
    const open = start < end ? time >= start && time < end : time >= start || time < end;
    if (open) return new Date(timestamp);
    const nextDay = time >= start ? DAY_MS : 0;
    earliest = Math.min(earliest, dayStart + nextDay + start - IST_OFFSET_MS);
  }
  return new Date(earliest);
}

export const isBroadcastWindowOpen = (date, settings) =>
  nextBroadcastWindowAt(date, settings)?.getTime() === new Date(date).getTime();
