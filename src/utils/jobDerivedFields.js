import { normalizeJobSearchKey } from "./jobSearchKeys.js";
import { getValidIndiaCityForJob } from "./publicJobLocationScope.js";

const toValidDate = (value) => {
  if (value == null || value === "") return null;
  const normalized = value instanceof Date ? value : new Date(value);
  return Number.isFinite(normalized.getTime()) ? normalized : null;
};

export const resolveJobSortDate = (job = {}) => (
  toValidDate(job.sortDate)
  ?? toValidDate(job.postedAt)
  ?? toValidDate(job.createdAt)
  ?? toValidDate(job.scrapedAt)
  ?? null
);

export const buildJobDerivedFields = (job = {}) => {
  const publicCity = getValidIndiaCityForJob(job);

  return {
    sortDate: resolveJobSortDate(job),
    isPublicIndia: publicCity !== null,
    publicCityKey: normalizeJobSearchKey(publicCity),
  };
};
