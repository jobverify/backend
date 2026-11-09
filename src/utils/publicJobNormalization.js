// Share the effective public category between API output and saved-filter matching.
import { resolveJobType } from '../../scraper-support/utils/normalizeScrapedJob.js';
import { getAuthoritativeClassification } from '../services/jobClassificationPolicy.js';
import { normalizePublicJobType } from './publicJobTypeLabel.js';

const MAX_REASONABLE_EXPERIENCE_YEARS = 40;
const MAX_EXPERIENCE_FILTER_YEAR = 15;
const EXPERIENCE_RANGE_PATTERN = /(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\b/i;
const EXPERIENCE_PLUS_PATTERN = /(\d+(?:\.\d+)?)\s*(?:\+|plus)\s*(?:years?|yrs?)\b/i;
const EXPERIENCE_ABOVE_PATTERN = /(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s*(?:and above|or above)\b/i;
const EXPERIENCE_MINIMUM_PATTERN = /(?:at least|min(?:imum)?(?: of)?|minimum|required|preferred)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\b/i;
const EXPERIENCE_VALUE_PATTERN = /(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\b/i;

const clampExperienceYear = (value) => {
  const normalized = Number.parseFloat(value);
  if (!Number.isFinite(normalized)) return null;
  return Math.min(MAX_EXPERIENCE_FILTER_YEAR, Math.max(0, normalized));
};

const extractExperienceYears = (value) => {
  const normalized = String(value || "")
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return [];

  if (/\b(no prior experience required|no experience required|freshers? can apply|freshers?|entry[- ]level applicants are encouraged)\b/i.test(normalized)) {
    return [0];
  }

  const rangeMatch = normalized.match(EXPERIENCE_RANGE_PATTERN);
  if (rangeMatch) {
    const start = clampExperienceYear(Math.ceil(Number.parseFloat(rangeMatch[1])));
    const end = clampExperienceYear(Math.floor(Number.parseFloat(rangeMatch[2])));
    if (start == null || end == null || end < start) return [];
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }

  const plusMatch = (
    normalized.match(EXPERIENCE_PLUS_PATTERN)
    || normalized.match(EXPERIENCE_ABOVE_PATTERN)
    || normalized.match(EXPERIENCE_MINIMUM_PATTERN)
  );
  if (plusMatch) {
    const start = clampExperienceYear(Math.ceil(Number.parseFloat(plusMatch[1])));
    if (start == null) return [];
    return Array.from(
      { length: MAX_EXPERIENCE_FILTER_YEAR - start + 1 },
      (_, index) => start + index,
    );
  }

  const valueMatch = normalized.match(EXPERIENCE_VALUE_PATTERN);
  if (valueMatch) {
    const year = clampExperienceYear(Math.round(Number.parseFloat(valueMatch[1])));
    return year == null ? [] : [year];
  }

  return [];
};

const isPartTimeJobType = (value) => /part[\s_-]?time/i.test(String(value || ""));

const normalizeJobTypeLabel = (value) => {
  const normalized = String(value || "").trim().toLowerCase();

  if (!normalized) return null;
  if (normalized === "intern" || normalized === "internship") return "Intern";
  if (normalized === "contract") return "Contract";
  if (normalized === "others") return "Others";
  if (normalized === "unspecified") return "Unspecified";
  if (normalized === "full-time fresher") return "Full-time Fresher";
  if (normalized === "full-time experienced") return "Full-time Experienced";
  if (normalized === "full-time") return "Full-time";
  return null;
};

const deriveExperienceLevelFromYears = (minimumYears) => {
  if (!Number.isFinite(minimumYears) || minimumYears < 0) return null;
  if (minimumYears === 0) return "Entry Level";
  if (minimumYears <= 2) return "Junior Level";
  if (minimumYears >= 8) return "Senior Level";
  return "Mid Level";
};

const getStructuredExperienceMinimumYears = (job = {}) => {
  const minimumYears = Number(job?.experienceProfile?.minimumYears);

  return Number.isFinite(minimumYears)
    && minimumYears >= 0
    && minimumYears <= MAX_REASONABLE_EXPERIENCE_YEARS
    ? minimumYears
    : null;
};

const hasPositiveExperienceSignal = (job = {}) => {
  const minimumYears = Number(job?.experienceProfile?.minimumYears);
  const maximumYears = Number(job?.experienceProfile?.maximumYears);
  const experienceYears = extractExperienceYears(job?.experienceRequired);
  const normalizedExperienceText = String(job?.experienceRequired || "")
    .replace(/[â€“â€”âˆ’]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  return (
    (Number.isFinite(minimumYears) && minimumYears > 0)
    || (!Number.isFinite(minimumYears) && Number.isFinite(maximumYears) && maximumYears > 0)
    || (
      job?.experienceProfile?.isOpenEnded === true
      && Number.isFinite(minimumYears)
      && minimumYears > 0
    )
    || experienceYears[0] > 0
    || (
      experienceYears.length === 0
      && /\b(?:[1-9]\d*(?:\.\d+)?|0?\.\d*[1-9]\d*)\s*(?:\+|plus)?\s*(?:years?|yrs?)\b/i.test(normalizedExperienceText)
    )
  );
};

export const normalizePublicExperienceLevel = (job = {}) => {
  const classified = getAuthoritativeClassification(job);
  if (classified) return classified.experienceLevel ?? null;
  const derivedFromProfile = deriveExperienceLevelFromYears(
    getStructuredExperienceMinimumYears(job),
  );
  const derivedFromText = deriveExperienceLevelFromYears(
    extractExperienceYears(job?.experienceRequired)[0],
  );
  const derivedExperienceLevel = derivedFromProfile || derivedFromText;
  const storedExperienceLevel = String(job?.experienceLevel || "").trim();

  if (!derivedExperienceLevel) {
    return storedExperienceLevel || null;
  }

  if (
    !storedExperienceLevel
    || (
      ["Entry Level", "Junior Level"].includes(storedExperienceLevel)
      && ["Mid Level", "Senior Level"].includes(derivedExperienceLevel)
    )
  ) {
    return derivedExperienceLevel;
  }

  return storedExperienceLevel;
};

const resolveResponseJobType = (job = {}) => {
  const classified = getAuthoritativeClassification(job);
  if (classified) return classified.jobType;
  if (Object.hasOwn(job, "_publicJobType")) return job._publicJobType;
  const normalizedLabel = normalizeJobTypeLabel(job.jobType);
  const normalizedExperienceLevel = normalizePublicExperienceLevel(job);
  const resolved = resolveJobType({
    ...job,
    experienceLevel: normalizedExperienceLevel,
  });
  const normalizedResolved = resolved
    ? normalizeJobTypeLabel(resolved) || resolved
    : null;

  if (
    hasPositiveExperienceSignal(job)
    && normalizedLabel !== "Contract"
    && normalizedLabel !== "Others"
    && (
      normalizedLabel === "Full-time Fresher"
      || normalizedLabel === "Full-time Experienced"
      || normalizedLabel === "Full-time"
      || normalizedLabel === "Intern"
      || normalizedResolved === "Full-time Fresher"
    )
  ) {
    return "Full-time Experienced";
  }

  if (
    normalizedLabel
    && normalizedResolved
    && normalizedLabel !== "Full-time"
    && normalizedResolved !== "Full-time"
    && normalizedLabel !== normalizedResolved
    && (
      normalizedLabel === "Full-time Fresher"
      || normalizedLabel === "Full-time Experienced"
    )
  ) {
    return isPartTimeJobType(normalizedResolved) ? null : normalizedResolved;
  }

  if (normalizedLabel && normalizedLabel !== "Full-time") {
    return isPartTimeJobType(normalizedLabel) ? null : normalizedLabel;
  }

  if (normalizedResolved) {
    return isPartTimeJobType(normalizedResolved) ? null : normalizedResolved;
  }

  return isPartTimeJobType(job.jobType) ? null : job.jobType || null;
};

export const normalizePublicJobCategory = job => normalizePublicJobType(resolveResponseJobType(job));
