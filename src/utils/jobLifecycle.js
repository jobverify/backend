export const DEFAULT_JOB_RETENTION_DAYS = 60;
export const DEFAULT_JOB_MISSES_BEFORE_EXPIRY = 2;

const parseIntegerAtLeast = (value, fallback, minimum) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= minimum ? parsed : fallback;
};

export const normalizeLifecycleDate = (value) => {
  if (value == null || value === "") return null;

  const timestamp = typeof value === "number"
    && Math.abs(value) >= 1_000_000_000
    && Math.abs(value) < 100_000_000_000
    ? value * 1_000
    : value;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const resolveJobPostedAt = (job = {}) => (
  normalizeLifecycleDate(job.postingDate)
  || normalizeLifecycleDate(job.postedAt)
  || normalizeLifecycleDate(job.scrapedTimestamp)
  || normalizeLifecycleDate(job.scrapedAt)
);

export const resolveJobRetentionDays = (
  value = process.env.SCRAPER_JOB_POSTED_WITHIN_DAYS,
) => parseIntegerAtLeast(value, DEFAULT_JOB_RETENTION_DAYS, 1);

export const resolveJobMissesBeforeExpiry = (
  value = process.env.SCRAPER_JOB_MISSES_BEFORE_EXPIRY,
) => parseIntegerAtLeast(value, DEFAULT_JOB_MISSES_BEFORE_EXPIRY, 2);

export const startOfUtcDay = (value = new Date()) => {
  const date = normalizeLifecycleDate(value) || new Date();
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  ));
};

export const buildJobPostedAtCutoff = (
  now = new Date(),
  retentionDays = resolveJobRetentionDays(),
) => {
  const cutoff = startOfUtcDay(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - resolveJobRetentionDays(retentionDays));
  return cutoff;
};

// Public eligibility uses calendar months independently of storage retention.
export const buildPublishableJobPostedAtCutoff = (now = new Date()) => {
  const cutoff = startOfUtcDay(now);
  const day = cutoff.getUTCDate();
  cutoff.setUTCDate(1);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 1);
  const lastDay = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0)).getUTCDate();
  cutoff.setUTCDate(Math.min(day, lastDay));
  return cutoff;
};
