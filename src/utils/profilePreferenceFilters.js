import { normalizePreferredJobType } from '../constants/preferredJobTypes.js';

const PROFILE_PREFERENCE_SORT_OPTIONS = ["all", "popularity", "latest", "oldest"];
const MAX_PROFILE_TEXT_LENGTH = 80;
const MAX_PROFILE_ITEMS = 20;

const normalizeStringList = (value) => {
  const list = Array.isArray(value) ? value : String(value ?? "").split(",");
  return [...new Set(
    list
      .map((item) => String(item ?? "").trim().slice(0, MAX_PROFILE_TEXT_LENGTH))
      .filter(Boolean),
  )].slice(0, MAX_PROFILE_ITEMS);
};

const normalizeDatePostedList = (value) => {
  const list = Array.isArray(value) ? value : String(value ?? "").split(",");
  return [...new Set(
    list
      .map((item) => String(item ?? "").trim().toLowerCase())
      .filter((item) => item === "na" || item === "older-than-30" || (/^\d+$/u.test(item) && Number(item) >= 0 && Number(item) <= 30)),
  )].slice(0, MAX_PROFILE_ITEMS);
};

export function normalizeProfilePreferenceFilters(input = {}) {
  const sortBy = PROFILE_PREFERENCE_SORT_OPTIONS.includes(input.sortBy)
    ? input.sortBy
    : "all";

  return {
    company: normalizeStringList(input.company),
    jobType: normalizeStringList(input.jobType),
    location: normalizeStringList(input.location),
    experienceYear: String(input.experienceYear ?? "").trim(),
    roleDomain: normalizeStringList(input.roleDomain),
    workArrangement: normalizeStringList(input.workArrangement),
    datePostedDays: normalizeDatePostedList(input.datePostedDays),
    sortBy,
  };
}

export function deriveLegacyProfilePreferences(filters = {}) {
  return {
    locationPreference: Array.isArray(filters.location) ? filters.location : [],
    preferredJobTypes: (Array.isArray(filters.jobType) ? filters.jobType : [])
      .map(normalizePreferredJobType)
      .filter(Boolean),
  };
}

export { PROFILE_PREFERENCE_SORT_OPTIONS };
