// Weeks start on Monday; dates follow the same calendar clock as existing day filters.
export const CALENDAR_POSTED_PERIODS = Object.freeze(["this-week", "last-week", "this-month", "last-month"]);

export function buildPostedDateRange(value, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  if (value === 'this-week' || value === 'last-week') {
    start.setDate(start.getDate() - (start.getDay() + 6) % 7 - (value === 'last-week' ? 7 : 0));
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 7);
  } else if (value === 'this-month' || value === 'last-month') {
    start.setDate(1);
    if (value === 'last-month') start.setMonth(start.getMonth() - 1);
    end.setTime(start.getTime());
    end.setMonth(end.getMonth() + 1);
  } else {
    start.setDate(start.getDate() - Number(value));
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 1);
  }
  return { $gte: start, $lt: end };
}
