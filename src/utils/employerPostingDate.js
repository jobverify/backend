import { parseWorkdayNativeLifecycleDate } from '../../scraper-support/myworkday/nativeLifecycleDates.js';

const strictDate = value => parseWorkdayNativeLifecycleDate(
  value instanceof Date ? value.toISOString() : value,
).date;

/** Legacy source/observation flags alone cannot establish an employer date. */
export function resolveEmployerPostedAt(job = {}) {
  // An explicit null records rejected evidence; alias normalization must not
  // turn it back into a verified date on a later pass through saveToDB.
  if (job.sourceDetailComplete === false || job.employerPostedAt === null) return null;
  try {
    let date;
    if (job.sourceDateProvenance === 'workday-cxs-jobPostingInfo') {
      const native = parseWorkdayNativeLifecycleDate(job.sourceRawDates?.startDate);
      if (!native.date || native.precision !== job.postingDatePrecision
        || native.exact !== job.sourcePostingDateIsExact) return null;
      date = native.date;
    } else {
      if (!job.employerPostedAt || job.postedAtProvenance !== 'source') return null;
      date = strictDate(job.employerPostedAt);
      if (!date || job.postedAtProvenanceValue !== date.toISOString()) return null;
    }
    const aliases = [job.postingDate, job.postedAt].filter(value => value != null);
    if (!aliases.length) return null;
    const values = [...aliases, job.employerPostedAt].filter(value => value != null);
    if (values.some(value => {
      const parsed = strictDate(value);
      return !parsed || +parsed !== +date;
    })) return null;
    return date;
  } catch (error) {
    if (error.code === 'WORKDAY_NATIVE_DATE_INVALID' || error instanceof RangeError) return null;
    throw error;
  }
}
