import { getPreferredJobTypeMatches } from "../constants/preferredJobTypes.js";
import { withSemanticExperienceConstraint, matchesExperienceFilter } from '../utils/classifiedExperienceFilters.js';
import {
  DATE_POSTED_NA_VALUE,
  DATE_POSTED_OLDER_THAN_30_VALUE,
  DATE_POSTED_OPTIONS,
  EXPERIENCE_BUCKET_VALUES,
  ROLE_DOMAIN_OPTIONS,
  SENIORITY_LEVELS,
  SKILL_MATCH_MODE_OPTIONS,
  SKILL_SCOPE_OPTIONS,
  WORK_ARRANGEMENT_OPTIONS,
  resolveSkillTokens,
} from "../constants/jobFilterTaxonomy.js";
import { normalizeJobSearchKey } from "../utils/jobSearchKeys.js";
import { normalizeProfilePreferenceFilters } from "../utils/profilePreferenceFilters.js";
import { PUBLIC_WORK_ARRANGEMENT_EXPRESSION, normalizePublicWorkArrangement } from '../utils/publicWorkArrangement.js';
import { normalizePublicJobCategory } from '../utils/publicJobNormalization.js';
import { getPublicJobTypeMatches } from '../utils/publicJobTypeLabel.js';
import { batchYearFilter, hasBatchEligibility, matchesBatchYear, validBatchYear } from '../utils/jobBatchEligibility.js';

const MAX_REGEX_FILTER_LENGTH = 80;
const MAX_TEXT_QUERY_LENGTH = 200;
const MAX_EXPERIENCE_FILTER_YEAR = 15;
const EXPERIENCE_UNSPECIFIED_VALUE = "unspecified";
const EXPERIENCE_TEXT_HINT_PATTERN = /(^|[^0-9.])(?:\d+(?:\.\d+)?\s*(?:(?:-|to)\s*\d+(?:\.\d+)?\s*)?(?:(?:\+|plus)\s*)?(?:years?|yrs?)\b|\d+(?:\.\d+)?\s*(?:years?|yrs?)\s*(?:and above|or above)\b|(?:at least|min(?:imum)?(?: of)?|minimum|required|preferred)\s*\d+(?:\.\d+)?\s*(?:years?|yrs?)\b|no prior experience required|no experience required|freshers? can apply|freshers?|entry[- ]level applicants are encouraged|experienced(?: professionals?)?|entry[- ]level|junior level|mid(?:-| )level|senior(?:-| )level|associate(?: level)?)/i;

const normalizeFilterText = (value, maxLength = MAX_TEXT_QUERY_LENGTH) => String(value ?? "")
  .trim()
  .replace(/\s+/g, " ")
  .slice(0, maxLength);

const normalizeList = (value, { maxItems = 20, maxLength = MAX_REGEX_FILTER_LENGTH } = {}) => (
  (Array.isArray(value) ? value : String(value || "").split(","))
    .map((item) => normalizeFilterText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems)
);

const normalizeExactList = (value, { maxItems = 20, maxLength = MAX_REGEX_FILTER_LENGTH } = {}) => {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(list.map((item) => normalizeFilterText(item, maxLength)).filter(Boolean))]
    .slice(0, maxItems);
};

const normalizeOptionValue = (value, options = []) => {
  const normalized = normalizeFilterText(value).toLowerCase();
  return options.find((option) => String(option).toLowerCase() === normalized) || null;
};

const normalizeOptionValues = (value, options = []) => [...new Set(
  normalizeList(value, { maxItems: options.length || 20, maxLength: MAX_TEXT_QUERY_LENGTH })
    .map((item) => normalizeOptionValue(item, options))
    .filter(Boolean),
)];

const buildDatePostedFilter = (values) => {
  const clauses = values.map((value) => {
    if (value === DATE_POSTED_NA_VALUE) return { postedAt: null };
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (value === DATE_POSTED_OLDER_THAN_30_VALUE) {
      start.setDate(start.getDate() - 30);
      return { postedAt: { $type: "date", $lt: start } };
    }
    start.setDate(start.getDate() - value);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { postedAt: { $gte: start, $lt: end } };
  });
  return clauses.length === 1 ? clauses[0] : { $or: clauses };
};

const appendFilterConstraint = (filters, condition) => {
  if (!condition) return;
  if (!Array.isArray(filters.$and)) filters.$and = [];
  filters.$and.push(condition);
};

const buildExperienceYearConstraint = (years) => {
  const normalizedYears = [...new Set(years.map(Number).filter(Number.isFinite))];
  const constraints = [];
  if (normalizedYears.includes(0)) {
    constraints.push(withSemanticExperienceConstraint(0, { $and: [{ experienceYears: { $in: [0] } }, { jobType: { $in: getPreferredJobTypeMatches("Full-time Fresher") } }] }));
  }
  const nonZeroYears = normalizedYears.filter((year) => year !== 0);
  for (const year of nonZeroYears) constraints.push(withSemanticExperienceConstraint(year, { experienceYears: { $in: [year] } }));
  return constraints.length === 1 ? constraints[0] : constraints.length > 1 ? { $or: constraints } : null;
};

const buildUnspecifiedExperienceConstraint = () => withSemanticExperienceConstraint('unspecified', {
  $and: [{
    $or: [
      { experienceBucket: EXPERIENCE_UNSPECIFIED_VALUE },
      { experienceYears: { $exists: false } }, { experienceYears: null }, { experienceYears: { $size: 0 } },
      { experienceRequired: { $exists: false } }, { experienceRequired: null }, { experienceRequired: "" },
    ],
  }, {
    $or: [
      { "experienceProfile.hasExplicitExperience": { $exists: false } },
      { "experienceProfile.hasExplicitExperience": false },
      { experienceRequired: { $exists: false } }, { experienceRequired: null }, { experienceRequired: "" },
      { experienceRequired: { $not: EXPERIENCE_TEXT_HINT_PATTERN } },
    ],
  }],
});

const isPostedInCalendarDayWindow = (postedAt, days, now) => {
  const postedDate = new Date(postedAt);
  if (Number.isNaN(postedDate.getTime())) return false;

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - Number(days));
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return postedDate >= start && postedDate < end;
};

const isPostedMoreThanThirtyDaysAgo = (postedAt, now) => {
  const postedDate = new Date(postedAt);
  if (Number.isNaN(postedDate.getTime())) return false;

  const cutoff = new Date(now);
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - 30);
  return postedDate < cutoff;
};

export const buildJobFilterConditions = (queryParams = {}, { includeExperienceYear = true } = {}) => {
  const { query, location, company, city, jobType, batch, branch, skills, skillMatchMode, skillScope, experienceYear, experienceBucket, roleDomain, seniority, workArrangement, datePostedDays } = queryParams;
  const filters = { status: "active" };
  const companyKeys = normalizeExactList(company).map(normalizeJobSearchKey).filter(Boolean);
  if (companyKeys.length === 1) filters.companyKey = companyKeys[0];
  if (companyKeys.length > 1) filters.companyKey = { $in: companyKeys };
  const cityKeys = normalizeList(city).filter((value) => value.toLowerCase() !== "none").map(normalizeJobSearchKey).filter(Boolean);
  if (cityKeys.length === 1) filters.locationKeys = cityKeys[0];
  if (cityKeys.length > 1) filters.locationKeys = { $in: cityKeys };
  const locationKeys = normalizeList(location).map(normalizeJobSearchKey).filter(Boolean);
  if (locationKeys.length && !filters.locationKeys) filters.locationKeys = { $in: locationKeys };
  const jobTypes = [...new Set(normalizeList(jobType).flatMap(getPublicJobTypeMatches))];
  if (jobTypes.length) filters.jobType = { $in: jobTypes };
  const batchValues = normalizeList(batch).map(Number).filter(validBatchYear);
  if (batchValues.length) appendFilterConstraint(filters, batchYearFilter(batchValues));
  const branches = normalizeList(branch);
  if (branches.length) filters.branches = { $in: branches };
  const skillValues = resolveSkillTokens(normalizeList(skills, { maxItems: 8, maxLength: MAX_REGEX_FILTER_LENGTH }));
  if (skillValues.length) {
    const matchMode = normalizeOptionValue(skillMatchMode, SKILL_MATCH_MODE_OPTIONS.map(({ value }) => value)) || "any";
    const scope = normalizeOptionValue(skillScope, SKILL_SCOPE_OPTIONS.map(({ value }) => value)) || "all";
    filters[scope === "required" ? "requiredSkillIds" : "skillIds"] = matchMode === "all" ? { $all: skillValues } : { $in: skillValues };
  }
  if (includeExperienceYear) {
    const experienceValues = normalizeList(experienceYear, { maxItems: MAX_EXPERIENCE_FILTER_YEAR + 2, maxLength: 16 });
    const years = [...new Set(experienceValues.map(Number).filter((year) => Number.isInteger(year) && year >= 0 && year <= MAX_EXPERIENCE_FILTER_YEAR))];
    const constraints = [buildExperienceYearConstraint(years)];
    if (experienceValues.some((value) => value.toLowerCase() === EXPERIENCE_UNSPECIFIED_VALUE)) constraints.push(buildUnspecifiedExperienceConstraint());
    const active = constraints.filter(Boolean);
    if (active.length === 1) appendFilterConstraint(filters, active[0]);
    if (active.length > 1) appendFilterConstraint(filters, { $or: active });
  }
  for (const [value, field, options] of [[experienceBucket, "experienceBucket", EXPERIENCE_BUCKET_VALUES], [roleDomain, "primaryRoleDomain", ROLE_DOMAIN_OPTIONS], [workArrangement, "workArrangement", WORK_ARRANGEMENT_OPTIONS]]) {
    const values = normalizeOptionValues(value, options);
    if (field === 'workArrangement') {
      if (values.length) appendFilterConstraint(filters, { $expr: { $in: [PUBLIC_WORK_ARRANGEMENT_EXPRESSION, values] } });
      continue;
    }
    if (values.length === 1) filters[field] = values[0];
    if (values.length > 1) filters[field] = { $in: values };
  }
  const seniorityValue = normalizeOptionValue(seniority, SENIORITY_LEVELS);
  if (seniorityValue) filters.seniority = seniorityValue;
  const postedValues = [...new Set(normalizeList(datePostedDays, { maxItems: DATE_POSTED_OPTIONS.length, maxLength: 16 }).map((value) => {
    const normalized = value.toLowerCase();
    return normalized === DATE_POSTED_NA_VALUE || normalized === DATE_POSTED_OLDER_THAN_30_VALUE
      ? normalized
      : /^\d+$/u.test(normalized) && DATE_POSTED_OPTIONS.includes(Number(normalized)) ? Number(normalized) : null;
  }).filter((value) => value != null))];
  if (postedValues.length) Object.assign(filters, buildDatePostedFilter(postedValues));
  const cleanQuery = Array.isArray(query)
    ? query.slice(0, 50).map(value => normalizeFilterText(value)).filter(Boolean).join(' ')
    : normalizeFilterText(query);
  if (cleanQuery) filters.$text = { $search: cleanQuery };
  return filters;
};

export const hasSavedFilters = (filters = {}) => {
  const normalized = normalizeProfilePreferenceFilters(filters);
  return [normalized.company, normalized.jobType, normalized.location, normalized.roleDomain, normalized.workArrangement, normalized.datePostedDays]
    .some((items) => items.length > 0) || normalized.experienceYear !== "";
};

export const jobMatchesSavedFilters = ({ job, filters, userProfile = {}, now = new Date(), ignoreProfileEligibility = false }) => {
  const normalized = normalizeProfilePreferenceFilters(filters);
  if (!hasSavedFilters(normalized)) return false;
  const branch = String(userProfile.branch || "").trim().toLowerCase();
  const passingYear = Number(userProfile.passingYear);
  const branches = (job.branches || []).map((value) => String(value).trim().toLowerCase());
  if (!ignoreProfileEligibility && branches.length && !branches.includes(branch)) return false;
  if (!ignoreProfileEligibility && hasBatchEligibility(job) && !matchesBatchYear(job, passingYear)) return false;
  const jobTypes = getPublicJobTypeMatches(normalizePublicJobCategory(job));
  const location = [job.city, job.location].filter(Boolean).join(" ").toLowerCase();
  const experienceMatches = matchesExperienceFilter(job, normalized.experienceYear, (legacy) => {
    const text = String(legacy.experienceRequired || '').trim();
    const missing = legacy.experienceBucket === 'unspecified' || !legacy.experienceYears?.length || !text;
    return missing && (legacy.experienceProfile?.hasExplicitExperience !== true || !text || !EXPERIENCE_TEXT_HINT_PATTERN.test(text));
  });

  return (
    (normalized.company.length === 0 || normalized.company.some((value) => String(job.company || "").toLowerCase() === value.toLowerCase()))
    && (normalized.jobType.length === 0 || normalized.jobType.some((value) => getPublicJobTypeMatches(value).some((match) => jobTypes.includes(match))))
    && (normalized.location.length === 0 || normalized.location.some((value) => location.includes(String(value).toLowerCase())))
    && experienceMatches
    && (normalized.roleDomain.length === 0 || normalized.roleDomain.includes(job.primaryRoleDomain))
    && (normalized.workArrangement.length === 0 || normalized.workArrangement.includes(normalizePublicWorkArrangement(job.workArrangement, job)))
    && (normalized.datePostedDays.length === 0 || normalized.datePostedDays.some((value) => (
      value === DATE_POSTED_NA_VALUE
        ? !job.postedAt
        : value === DATE_POSTED_OLDER_THAN_30_VALUE
          ? job.postedAt && isPostedMoreThanThirtyDaysAgo(job.postedAt, now)
        : job.postedAt && isPostedInCalendarDayWindow(job.postedAt, value, now)
    )))
  );
};
