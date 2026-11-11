/**
 * @file Controllers for job listing searches, metadata extraction, and analytics tracking.
 * @module controllers/jobController
 */

import { randomUUID } from "node:crypto";
import { isProductionEnvironment } from "../utils/runtimeConfig.js";
import { isDeepStrictEqual } from "node:util";
import mongoose from "mongoose";
import Job from "../models/Job.js";
import Click from "../models/Click.js";
import { getPreferredJobTypeMatches } from "../constants/preferredJobTypes.js";
import {
  DATE_POSTED_NA_VALUE,
  DATE_POSTED_OLDER_THAN_30_VALUE,
  DATE_POSTED_OPTIONS,
  DATE_POSTED_WINDOW_OPTIONS,
  EXPERIENCE_BUCKET_OPTIONS,
  EXPERIENCE_BUCKET_VALUES,
  ROLE_DOMAIN_OPTIONS,
  SENIORITY_LEVELS,
  SKILL_MATCH_MODE_OPTIONS,
  SKILL_OPTIONS,
  SKILL_SCOPE_OPTIONS,
  WORK_ARRANGEMENT_OPTIONS,
  resolveSkillTokens,
} from "../constants/jobFilterTaxonomy.js";

import { PUBLIC_JOB_TYPE_EXPRESSION } from "../utils/publicJobType.js";
import { normalizePublicJobCategory as normalizeResponseJobType, normalizePublicExperienceLevel as normalizeResponseExperienceLevel } from '../utils/publicJobNormalization.js';
import { normalizePublicWorkArrangement, PUBLIC_WORK_ARRANGEMENT_EXPRESSION } from '../utils/publicWorkArrangement.js';
import { withSemanticExperienceConstraint } from '../utils/classifiedExperienceFilters.js';
import { applyPublicJobVisibility } from "../utils/publicJobVisibility.js";
import { recordApplicationOpen } from '../services/applicationService.js';
import { canUsePremiumFilters } from "../utils/accessControl.js";
import {
  formatStoredLocationLabel,
  mergeLocationOptions,
  normalizeStoredLocations,
  sanitizeStoredLocationValue,
} from "../utils/jobLocations.js";
import { normalizeJobSearchKey } from "../utils/jobSearchKeys.js";
import { withEmployerDisclosures } from "../utils/employerDisclosures.js";
import { getValidIndiaCityForJob } from "../utils/publicJobLocationScope.js";
import { normalizeLifecycleDate, startOfUtcDay } from "../utils/jobLifecycle.js";
import { safeSourceUrl } from '../utils/jobProvenance.js';
import { publicDescriptionFields } from '../utils/jobDescriptionDisplay.js';
import { hasWorkdayOutageSignal } from "../../scraper-support/myworkday/engine.js";
import {
  SearchInputError,
  buildJobSearchRequest,
  decodeJobSearchCursor,
  encodeJobSearchCursor,
} from "../services/jobSearchContract.js";
import {
  JOB_DATASET_LIFECYCLE_VERSION,
  refreshJobDatasetSummary,
  readJobDatasetSummary,
} from "../services/jobDatasetSummaryService.js";
import { buildJobFilterConditions } from "../services/jobFilterMatcher.js";
import { parseLegacyJobPagination } from "../utils/legacyJobPagination.js";

const MAX_REGEX_FILTER_LENGTH = 80;
const MAX_TEXT_QUERY_LENGTH = 200;
const MAX_RECOMMENDATION_TERMS = 20;
const CLICK_DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;
const PUBLIC_CACHE_HEADER =
  "no-store";
const PRIVATE_CACHE_HEADER = "no-store";
const FALLBACK_JOB_SLUG = "job";
const JOB_CARD_PAGE_LIMIT = 12;
const MAX_JOB_CARD_PAGE_LIMIT = 1000;
const MAX_EXPERIENCE_FILTER_YEAR = 15;
const MAX_QUERY_EXECUTION_MS = 800;
// Numbered pages also compute exact totals over the matching dataset. They
// cannot use the cursor search's sub-second budget on production-sized data.
const MAX_NUMBERED_QUERY_EXECUTION_MS = 5000;
const DEFAULT_COMPANY_META_LIMIT = 24;
const MAX_COMPANY_AUTOCOMPLETE_RESULTS = 2000;
const EXPERIENCE_UNSPECIFIED_VALUE = "unspecified";
const WORKDAY_APPLICATION_PROBE_TIMEOUT_MS = 5000;
const WORKDAY_APPLICATION_CACHE_TTL_MS = 30 * 60 * 1000;
const WORKDAY_APPLICATION_CACHE_MAX_ENTRIES = 250;
const APPLICATION_UNAVAILABLE_MESSAGE =
  "The original application link is unavailable for this listing.";
const WORKDAY_APPLICATION_UNAVAILABLE_MESSAGE =
  "Applications on this Workday portal are temporarily unavailable because Workday is showing a maintenance page. Please try again later.";
const WORKDAY_APPLICATION_GONE_MESSAGE =
  "This Workday application is no longer available.";
const WORKDAY_POSTING_UNAVAILABLE_PATTERN = /\bpostingAvailable\s*[:=]\s*false\b/i;
const PREMIUM_FILTER_KEYS = [
  "query",
  "company",
  "city",
  "location",
  "jobType",
  "batch",
  "branch",
  "skills",
  "experienceYear",
  "skillMatchMode",
  "skillScope",
  "experienceBucket",
  "roleDomain",
  "seniority",
  "workArrangement",
  "datePostedDays",
];
const JOB_LIST_CARD_FIELDS = Object.freeze([
  "title",
  "company",
  "location",
  "city",
  "locations",
  "jobType",
  "experienceRequired",
  "primaryRoleDomain",
  "seniority",
  "workArrangement",
  "eligibleBatches",
  "branches",
  "postedAt",
  "employerPostedAt",
  "postedAtProvenance",
  "postedAtProvenanceValue",
  "lastSeenAt",
  "closingDate",
  "salary",
  "employerExperienceLevel",
  "employerStreetAddress",
  "requiredSkills",
  "jobSkills",
  "applyUrl",
  "sourceUrl",
  "workdayApplicationStatus",
  "workdayApplicationStatusReason",
  "workdayApplicationStatusCheckedAt",
]);
const JOB_LIST_CURSOR_FIELDS = Object.freeze(["sortDate", "clickCount"]);
const JOB_LIST_QUERY_FIELDS = Object.freeze([
  ...new Set([...JOB_LIST_CARD_FIELDS, ...JOB_LIST_CURSOR_FIELDS, 'classification', 'employmentType', 'experienceLevel',
    'sourceRemoteStatusUnresolved', 'remoteStatus']),
]);
const JOB_LIST_CARD_PROJECTION = JOB_LIST_QUERY_FIELDS.join(" ");
const JOB_LIST_CARD_TEXT_PROJECTION = Object.freeze(
  Object.fromEntries(JOB_LIST_QUERY_FIELDS.map((field) => [field, 1])),
);
const JOB_LIST_CARD_AGGREGATE_PROJECT = { ...JOB_LIST_CARD_TEXT_PROJECTION, _publicJobType: PUBLIC_JOB_TYPE_EXPRESSION };

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const slugifyJob = (...parts) => {
  const slug = parts
    .filter(Boolean)
    .join(" ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s_-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90)
    .replace(/-$/g, "");

  return slug || FALLBACK_JOB_SLUG;
};

const normalizeFilterText = (value, maxLength = MAX_REGEX_FILTER_LENGTH) =>
  String(value || "").trim().slice(0, maxLength);

const normalizeCompanyOption = (value) =>
  String(value || "").replace(/\s+/g, " ").trim();

const normalizePublicCityOptions = (values = []) => mergeLocationOptions(
  values
    .map((value) => getValidIndiaCityForJob({ city: value, location: value }))
    .filter(Boolean),
);

const mergeCompanyOptions = (...lists) => {
  const seen = new Set();
  const companies = [];

  for (const value of lists.flat()) {
    const normalized = normalizeCompanyOption(value);
    if (!normalized) continue;

    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    companies.push(normalized);
  }

  return companies.sort((left, right) => left.localeCompare(right, "en", { sensitivity: "base" }));
};

const toValidDate = (value) => {
  const next = value == null ? null : new Date(value);
  return Number.isFinite(next?.getTime?.()) ? next : null;
};

const resolvePublicJobDatasetSummary = async (siteSettings = {}, { maxTimeMS = MAX_QUERY_EXECUTION_MS } = {}) => {
  // Stored summaries include all categories. Filtered views query their own scope.
  if (siteSettings.experiencedJobsEnabled === false) return null;
  const summary = await readJobDatasetSummary({ maxTimeMS });
  const now = new Date();
  const refreshedAt = normalizeLifecycleDate(summary?.refreshedAt);
  const nextClosingAt = normalizeLifecycleDate(summary?.nextClosingAt);
  const nextPublicationAt = normalizeLifecycleDate(summary?.nextPublicationAt);
  const isCurrentLifecycleDay = refreshedAt != null
    && refreshedAt <= now && refreshedAt >= startOfUtcDay(now);
  const isCurrentLifecycleScope = summary?.lifecycleVersion === JOB_DATASET_LIFECYCLE_VERSION;
  const hasPublishedRefresh = Number.isSafeInteger(summary?.publishedSequence)
    && summary.publishedSequence > 0
    && Number.isSafeInteger(summary?.refreshSequence)
    && summary.refreshSequence >= summary.publishedSequence;
  const hasNoElapsedClosingInstant = summary?.nextClosingAt == null
    || (nextClosingAt != null && nextClosingAt > now);
  const hasNoElapsedPublicationInstant = summary?.nextPublicationAt == null
    || (nextPublicationAt != null && nextPublicationAt > now);

  if (
    (summary != null && isCurrentLifecycleDay && isCurrentLifecycleScope && hasPublishedRefresh
      && hasNoElapsedClosingInstant && hasNoElapsedPublicationInstant)
    || mongoose.connection.readyState !== 1
  ) {
    return summary;
  }

  return refreshJobDatasetSummary({ maxTimeMS });
};

const resolvePublicJobDatasetTotals = async (siteSettings, queryOptions) => {
  const summary = await resolvePublicJobDatasetSummary(siteSettings, queryOptions);

  if (!summary) return null;

  return {
    total: Number(summary.totalJobs ?? 0),
    totalCompanies: Number(summary.totalCompanies ?? 0),
  };
};

const isDefaultPublicJobListFilter = (filters = {}) => (
  isDeepStrictEqual(filters, { status: "active" })
);

const workdayApplicationStatusCache = new Map();
const workdayApplicationRefreshes = new Map();

const buildEffectiveSortDateExpression = () => ({
  $ifNull: ["$sortDate", { $ifNull: ["$postedAt", { $ifNull: ["$createdAt", "$scrapedAt"] }] }],
});

const buildCompanySearchMatch = (searchTerm = "") => {
  const normalizedSearch = normalizeFilterText(searchTerm).toLowerCase();
  if (!normalizedSearch) return null;

  const rawRegex = buildSafeRegex(searchTerm);
  const normalizedRegex = new RegExp(escapeRegex(normalizedSearch));

  return {
    $or: [
      { company: { $regex: rawRegex } },
      { companyKey: { $regex: normalizedRegex } },
    ],
  };
};

const buildCompanyOptionPipeline = (
  baseFilter,
  {
    searchTerm = "",
    limit = DEFAULT_COMPANY_META_LIMIT,
    maximumLimit = DEFAULT_COMPANY_META_LIMIT,
  } = {},
) => {
  const safeLimit = Math.max(1, Math.min(limit, maximumLimit));
  const searchMatch = buildCompanySearchMatch(searchTerm);
  const pipeline = [{ $match: baseFilter }];

  if (searchMatch) {
    pipeline.push({ $match: searchMatch });
  }

  pipeline.push(
    {
      $group: {
        _id: "$companyKey",
        company: { $first: "$company" },
        activeJobCount: { $sum: 1 },
        latestSortDate: { $max: buildEffectiveSortDateExpression() },
      },
    },
    {
      $match: {
        company: { $exists: true, $ne: null },
      },
    },
    {
      $sort: {
        activeJobCount: -1,
        latestSortDate: -1,
        company: 1,
      },
    },
    {
      $limit: safeLimit,
    },
    {
      $project: {
        _id: 0,
        company: 1,
      },
    },
  );

  return pipeline;
};

const resolveActiveCompanyOptions = async (
  queryParams = {},
  {
    excludedKeys = [],
    searchTerm = "",
    limit = DEFAULT_COMPANY_META_LIMIT,
    maximumLimit = DEFAULT_COMPANY_META_LIMIT,
    siteSettings,
  } = {},
) => {
  const baseFilter = buildJobMetaFilter(queryParams, excludedKeys, { company: { $ne: null } }, siteSettings);
  const safeLimit = Math.max(1, Math.min(limit, maximumLimit));

  if (mongoose.connection.readyState !== 1) {
    const companies = await Job.distinct("company", baseFilter);
    const normalizedSearch = normalizeFilterText(searchTerm).toLowerCase();

    return mergeCompanyOptions(companies)
      .filter((company) => (
        !normalizedSearch
        || company.toLowerCase().includes(normalizedSearch)
      ))
      .slice(0, safeLimit);
  }

  const results = await Job.aggregate(
    buildCompanyOptionPipeline(baseFilter, {
      searchTerm,
      limit: safeLimit,
      maximumLimit,
    }),
  ).exec();

  return mergeCompanyOptions(results.map((entry) => entry.company));
};

const normalizeList = (value, { maxItems = 20, maxLength = MAX_REGEX_FILTER_LENGTH } = {}) => {
  const list = Array.isArray(value) ? value : String(value || "").split(",");
  return list
    .map((item) => normalizeFilterText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
};

const normalizeExactList = (value, { maxItems = 20, maxLength = MAX_REGEX_FILTER_LENGTH } = {}) => {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(
    list
      .map((item) => normalizeFilterText(item, maxLength))
      .filter(Boolean)
  )].slice(0, maxItems);
};

const normalizeOptionValue = (value, options = []) => {
  const normalized = normalizeFilterText(value, MAX_TEXT_QUERY_LENGTH).toLowerCase();
  if (!normalized) return null;

  return options.find((optionValue) => String(optionValue).toLowerCase() === normalized) || null;
};

const normalizeOptionValues = (value, options = []) => [...new Set(
  normalizeList(value, { maxItems: options.length || 20, maxLength: MAX_TEXT_QUERY_LENGTH })
    .map((item) => normalizeOptionValue(item, options))
    .filter(Boolean)
)];

const normalizeDatePostedDays = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === DATE_POSTED_NA_VALUE) return DATE_POSTED_NA_VALUE;

  if (!/^\d+$/u.test(normalized)) return null;

  const days = Number(normalized);
  return DATE_POSTED_OPTIONS.includes(days) ? days : null;
};

const normalizeDatePostedDaysValues = (value) => [...new Set(
  normalizeList(value, { maxItems: DATE_POSTED_OPTIONS.length, maxLength: 8 })
    .map((item) => normalizeDatePostedDays(item))
    .filter((item) => item != null)
)];

const buildDatePostedRange = (days) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { $gte: start, $lt: end };
};

const buildOlderThanThirtyDaysRange = () => {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - 30);
  return { $lt: cutoff };
};

const buildDatePostedFilter = (values) => {
  const clauses = values.map((value) => (
    value === DATE_POSTED_NA_VALUE
      ? { postedAt: null }
      : value === DATE_POSTED_OLDER_THAN_30_VALUE
        ? { postedAt: buildOlderThanThirtyDaysRange() }
      : { postedAt: buildDatePostedRange(value) }
  ));

  if (clauses.length === 1) {
    return clauses[0];
  }

  return { $or: clauses };
};

const normalizeSkillMatchMode = (value) => (
  normalizeOptionValue(
    value,
    SKILL_MATCH_MODE_OPTIONS.map(({ value: modeValue }) => modeValue),
  ) || "any"
);

const normalizeSkillScope = (value) => (
  normalizeOptionValue(
    value,
    SKILL_SCOPE_OPTIONS.map(({ value: scopeValue }) => scopeValue),
  ) || "all"
);

const buildSafeRegex = (value, { exact = false } = {}) => {
  const normalized = normalizeFilterText(value);
  if (!normalized) return null;
  const escaped = escapeRegex(normalized);
  return new RegExp(exact ? `^${escaped}$` : escaped, "i");
};

const resolveFrontendOrigin = () =>
  String(process.env.FRONTEND_ORIGIN || process.env.CORS_ORIGIN || "")
    .split(",")[0]
    .trim()
    .replace(/\/+$/, "");


const getSafeExternalApplicationUrl = (value) => {
  try {
    const url = new URL(String(value || "").trim());
    if (/(^|\.)(?:myworkdayjobs|workdayjobs|myworkdaysite)\.com$/i.test(url.hostname)) {
      url.pathname = url.pathname.replace(/\/apply\/?$/i, "");
    }
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
};

const trimWorkdayApplicationStatusCache = () => {
  while (workdayApplicationStatusCache.size > WORKDAY_APPLICATION_CACHE_MAX_ENTRIES) {
    const oldestKey = workdayApplicationStatusCache.keys().next().value;
    if (!oldestKey) return;
    workdayApplicationStatusCache.delete(oldestKey);
  }
};

const getCachedWorkdayApplicationState = (applicationUrl = "") => {
  const cachedEntry = workdayApplicationStatusCache.get(applicationUrl);
  if (!cachedEntry) return null;

  if (Date.now() - cachedEntry.checkedAt.getTime() > WORKDAY_APPLICATION_CACHE_TTL_MS) {
    workdayApplicationStatusCache.delete(applicationUrl);
    return null;
  }

  workdayApplicationStatusCache.delete(applicationUrl);
  workdayApplicationStatusCache.set(applicationUrl, cachedEntry);
  return cachedEntry;
};

const setCachedWorkdayApplicationState = (applicationUrl = "", state = {}) => {
  if (!applicationUrl) return null;

  const checkedAt = toValidDate(state.checkedAt) ?? new Date();
  const applicationStatus = state.applicationStatus === "temporarily_unavailable"
    ? "temporarily_unavailable"
    : state.applicationStatus === "unavailable"
      ? "unavailable"
      : "available";
  const normalizedState = {
    applicationStatus,
    applicationStatusReason: applicationStatus === "temporarily_unavailable"
      ? state.applicationStatusReason || WORKDAY_APPLICATION_UNAVAILABLE_MESSAGE
      : applicationStatus === "unavailable"
        ? state.applicationStatusReason || WORKDAY_APPLICATION_GONE_MESSAGE
        : null,
    checkedAt,
  };

  workdayApplicationStatusCache.delete(applicationUrl);
  workdayApplicationStatusCache.set(applicationUrl, normalizedState);
  trimWorkdayApplicationStatusCache();
  return normalizedState;
};

const getStoredWorkdayApplicationState = (job = {}, applicationUrl = "") => {
  const checkedAt = toValidDate(job.workdayApplicationStatusCheckedAt);
  if (!checkedAt) return null;

  if (Date.now() - checkedAt.getTime() > WORKDAY_APPLICATION_CACHE_TTL_MS) {
    return null;
  }

  return {
    applicationStatus: job.workdayApplicationStatus,
    applicationStatusReason: job.workdayApplicationStatusReason,
    checkedAt,
  };
};

const getFreshWorkdayApplicationState = (job = {}, applicationUrl = "") => {
  const cachedState = getCachedWorkdayApplicationState(applicationUrl);
  const storedState = getStoredWorkdayApplicationState(job, applicationUrl);
  const resolvedState = storedState && (
    !cachedState || storedState.checkedAt > cachedState.checkedAt
  )
    ? storedState
    : cachedState || storedState;

  return resolvedState && resolvedState === storedState
    ? setCachedWorkdayApplicationState(applicationUrl, storedState)
    : resolvedState;
};

const buildApplicationState = (job = {}) => {
  const applicationUrl = getSafeExternalApplicationUrl(job.applyUrl)
    || getSafeExternalApplicationUrl(job.sourceUrl);

  if (!applicationUrl) {
    return {
      applicationUrl: null,
      applicationStatus: "unavailable",
      applicationStatusReason: APPLICATION_UNAVAILABLE_MESSAGE,
    };
  }

  const resolvedWorkdayState = isWorkdayApplication(job, applicationUrl)
    ? getFreshWorkdayApplicationState(job, applicationUrl)
    : null;

  return {
    applicationUrl,
    applicationStatus: resolvedWorkdayState?.applicationStatus ?? "available",
    applicationStatusReason: resolvedWorkdayState?.applicationStatusReason ?? null,
  };
};

const isWorkdayApplication = (job = {}, applicationUrl = "") => {
  try {
    const hostname = new URL(applicationUrl).hostname.toLowerCase();
    return hostname === "myworkdayjobs.com"
      || hostname.endsWith(".myworkdayjobs.com")
      || hostname === "workdayjobs.com"
      || hostname.endsWith(".workdayjobs.com");
  } catch {
    return false;
  }
};

const withAbortTimeout = (timeoutMs) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    clear() {
      clearTimeout(timeoutId);
    },
  };
};

const probeWorkdayApplicationAvailability = async (job = {}) => {
  if (
    !job
    || job.applicationStatus !== "available"
    || !job.applicationUrl
    || !isWorkdayApplication(job, job.applicationUrl)
  ) {
    return job;
  }

  const { signal, clear } = withAbortTimeout(WORKDAY_APPLICATION_PROBE_TIMEOUT_MS);

  try {
    const response = await fetch(job.applicationUrl, {
      redirect: "error",
      signal,
    });
    const html = await response.text().catch(() => "");

    if (
      response.status === 404
      || response.status === 410
      || WORKDAY_POSTING_UNAVAILABLE_PATTERN.test(html)
    ) {
      return {
        applicationStatus: "unavailable",
        applicationStatusReason: WORKDAY_APPLICATION_GONE_MESSAGE,
      };
    }

    if (hasWorkdayOutageSignal({ html, url: response.url })) {
      return {
        applicationStatus: "temporarily_unavailable",
        applicationStatusReason: WORKDAY_APPLICATION_UNAVAILABLE_MESSAGE,
      };
    }
  } catch {
    return null;
  } finally {
    clear();
  }

  return {
    applicationStatus: "available",
    applicationStatusReason: null,
  };
};

const persistWorkdayApplicationAvailability = async (job = {}, state = {}) => {
  if (!job?._id || !job.applicationUrl) return;

  const checkedAt = toValidDate(state.checkedAt) ?? new Date();

  await Job.updateOne(
    {
      _id: job._id,
      $or: [
        { applyUrl: job.applyUrl || job.applicationUrl },
        { sourceUrl: job.sourceUrl || job.applicationUrl },
      ],
    },
    {
      $set: {
        workdayApplicationStatus: state.applicationStatus,
        workdayApplicationStatusReason: state.applicationStatusReason ?? null,
        workdayApplicationStatusCheckedAt: checkedAt,
      },
    },
  ).exec();
};

const scheduleWorkdayApplicationAvailabilityRefresh = (job = {}) => {
  if (
    !job
    || job.applicationStatus !== "available"
    || !job.applicationUrl
    || !isWorkdayApplication(job, job.applicationUrl)
    || getFreshWorkdayApplicationState(job, job.applicationUrl)
  ) {
    return null;
  }

  const existingRefresh = workdayApplicationRefreshes.get(job.applicationUrl);
  if (existingRefresh) return existingRefresh;

  const refreshPromise = (async () => {
    const probedState = await probeWorkdayApplicationAvailability(job);
    if (!probedState) return null;

    const nextState = setCachedWorkdayApplicationState(job.applicationUrl, {
      ...probedState,
      checkedAt: new Date(),
    });

    try {
      await persistWorkdayApplicationAvailability(job, nextState);
    } catch (error) {
      if (!isProductionEnvironment()) {
        console.warn("Unable to persist Workday application availability", error);
      }
    }

    return nextState;
  })().finally(() => {
    workdayApplicationRefreshes.delete(job.applicationUrl);
  });

  workdayApplicationRefreshes.set(job.applicationUrl, refreshPromise);
  return refreshPromise;
};

export const normalizeResponseJob = (job) => {
  if (!job) return job;

  const {
    workdayApplicationStatus: _workdayApplicationStatus,
    workdayApplicationStatusReason: _workdayApplicationStatusReason,
    workdayApplicationStatusCheckedAt: _workdayApplicationStatusCheckedAt,
    _publicJobType,
    classification: _classification,
    postClassification: _postClassification,
    sourceDescription: _sourceDescription,
    sourceContentHash: _sourceContentHash,
    sourceContentHashVersion: _sourceContentHashVersion,
    descriptionRewrite: _descriptionRewrite,
    provenance: _provenance,
    ...publicJob
  } = job;
  const locations = normalizeStoredLocations(publicJob);
  const location = locations.length > 0
    ? formatStoredLocationLabel({ locations })
    : formatStoredLocationLabel({
      location: publicJob.location,
      city: publicJob.city,
    });

  return withEmployerDisclosures({
    ...publicJob,
    ...publicDescriptionFields(job),
    location: location || null,
    city: sanitizeStoredLocationValue(publicJob.city),
    locations,
    experienceLevel: normalizeResponseExperienceLevel(job),
    jobType: normalizeResponseJobType(job),
    workArrangement: normalizePublicWorkArrangement(job.workArrangement, job),
    ...buildApplicationState(job),
  });
};

export const normalizeJobListResponseJob = (job) => {
  const normalized = normalizeResponseJob(job);
  if (!normalized) return normalized;

  const {
    clickCount: _clickCount,
    createdAt: _createdAt,
    sortDate: _sortDate,
    _cursorDate: _cursorDate,
    ...responseJob
  } = normalized;

  return responseJob;
};

const normalizeJobTypeFilters = (value) => {
  const jobTypes = normalizeList(value);
  return [...new Set(
    jobTypes.flatMap((jobTypeValue) => {
      const normalized = normalizeResponseJobType({ jobType: jobTypeValue });
      if (!normalized) return [];

      const storedMatches = getPreferredJobTypeMatches(normalized);
      return storedMatches.length > 0 ? storedMatches : [normalized];
    })
  )];
};

const EXPERIENCE_FILTER_OPTIONS = Object.freeze(
  Array.from({ length: MAX_EXPERIENCE_FILTER_YEAR + 1 }, (_, index) => index),
);
const EXPERIENCE_YEAR_UNIT_REGEX_SOURCE = "(?:years?|yrs?)";
const EXPERIENCE_TEXT_HINT_PATTERN = /(^|[^0-9.])(?:\d+(?:\.\d+)?\s*(?:(?:-|to)\s*\d+(?:\.\d+)?\s*)?(?:(?:\+|plus)\s*)?(?:years?|yrs?)\b|\d+(?:\.\d+)?\s*(?:years?|yrs?)\s*(?:and above|or above)\b|(?:at least|min(?:imum)?(?: of)?|minimum|required|preferred)\s*\d+(?:\.\d+)?\s*(?:years?|yrs?)\b|no prior experience required|no experience required|freshers? can apply|freshers?|entry[- ]level applicants are encouraged|experienced(?: professionals?)?|entry[- ]level|junior level|mid(?:-| )level|senior(?:-| )level|associate(?: level)?)/i;

const normalizeExperienceFilterValues = (value) => normalizeList(value, {
  maxItems: MAX_EXPERIENCE_FILTER_YEAR + 2,
  maxLength: 16,
});

const normalizeExperienceYearFilters = (value) => [...new Set(
  normalizeExperienceFilterValues(value)
    .map((item) => Number.parseInt(String(item).trim(), 10))
    .filter((year) => (
      Number.isFinite(year)
      && year >= 0
      && year <= MAX_EXPERIENCE_FILTER_YEAR
    )),
)];

const hasUnspecifiedExperienceFilter = (value) => (
  normalizeExperienceFilterValues(value)
    .some((item) => item.toLowerCase() === EXPERIENCE_UNSPECIFIED_VALUE)
);

const buildFresherJobTypeConstraint = () => {
  const fresherJobTypes = getPreferredJobTypeMatches("Full-time Fresher");

  if (fresherJobTypes.length === 1) {
    return { jobType: fresherJobTypes[0] };
  }

  if (fresherJobTypes.length > 1) {
    return { jobType: { $in: fresherJobTypes } };
  }

  return null;
};

const buildExperienceYearMatchConstraint = (years = []) => {
  const normalizedYears = [...new Set(
    years
      .map((year) => Number.parseInt(String(year), 10))
      .filter((year) => Number.isFinite(year)),
  )];

  return normalizedYears.length > 0
    ? { experienceYears: { $in: normalizedYears } }
    : null;
};

const buildExperienceYearConstraint = (years = []) => {
  const normalizedYears = [...new Set(
    years
      .map((year) => Number.parseInt(String(year), 10))
      .filter((year) => Number.isFinite(year)),
  )];
  const constraints = [];

  if (normalizedYears.includes(0)) {
    const zeroYearConstraint = buildExperienceYearMatchConstraint([0]);
    const fresherJobTypeConstraint = buildFresherJobTypeConstraint();
    if (zeroYearConstraint && fresherJobTypeConstraint) {
      constraints.push(withSemanticExperienceConstraint(0, { $and: [zeroYearConstraint, fresherJobTypeConstraint] }));
    }
  }

  const nonZeroYears = normalizedYears.filter((year) => year !== 0);
  if (nonZeroYears.length > 0) {
    constraints.push(buildExperienceYearMatchConstraint(nonZeroYears));
  }

  const activeConstraints = constraints.filter(Boolean);
  if (activeConstraints.length === 1) return activeConstraints[0];
  if (activeConstraints.length > 1) return { $or: activeConstraints };
  return null;
};

const buildUnspecifiedExperienceConstraint = () => withSemanticExperienceConstraint('unspecified', {
  $and: [
    {
      $or: [
        { experienceBucket: EXPERIENCE_UNSPECIFIED_VALUE },
        { experienceYears: { $exists: false } },
        { experienceYears: null },
        { experienceYears: { $size: 0 } },
        { experienceRequired: { $exists: false } },
        { experienceRequired: null },
        { experienceRequired: "" },
      ],
    },
    {
      $or: [
        { "experienceProfile.hasExplicitExperience": { $exists: false } },
        { "experienceProfile.hasExplicitExperience": false },
        { experienceRequired: { $exists: false } },
        { experienceRequired: null },
        { experienceRequired: "" },
        { experienceRequired: { $not: EXPERIENCE_TEXT_HINT_PATTERN } },
      ],
    },
  ],
});

const appendFilterConstraint = (filters, condition) => {
  if (!condition) return;

  if (!Array.isArray(filters.$and)) {
    filters.$and = [];
  }

  filters.$and.push(condition);
};

const sendJobsResponse = (res, jobs, pageNum, limitNum, total, totalCompanies) => {
  const totalPages = Math.ceil(total / limitNum) || 1;

  return res.status(200).json({
    code: 200,
    success: true,
    message: "Jobs retrieved successfully",
    data: jobs.map(normalizeJobListResponseJob),
    pagination: {
      total,
      totalCompanies,
      page: pageNum,
      limit: limitNum,
      totalPages,
    },
  });
};

const applyJobListProjection = (query, { includeTextScore = false } = {}) => (
  query.select(
    includeTextScore
      ? { ...JOB_LIST_CARD_AGGREGATE_PROJECT, score: { $meta: "textScore" } }
      : JOB_LIST_CARD_AGGREGATE_PROJECT,
  )
);

const resolveJobListSortOption = ({ sort, hasTextSearch = false } = {}) => {
  if (sort === "popularity") {
    return { clickCount: -1, sortDate: -1, _id: -1 };
  }

  if (sort === "latest") {
    return { sortDate: -1, _id: -1 };
  }

  if (sort === "oldest") {
    return { sortDate: 1, _id: 1 };
  }

  if (hasTextSearch) {
    return { score: { $meta: "textScore" }, sortDate: -1, _id: -1 };
  }

  return { sortDate: -1, _id: -1 };
};

const resolveNumberedJobQueryOptions = (filters, sort) => {
  const options = { maxTimeMS: MAX_NUMBERED_QUERY_EXECUTION_MS };
  // Semantic visibility expressions make trial plans expensive. Start with the
  // existing equality-key index instead of trialling unrelated multikey indexes.
  // Text searches must retain Mongo's text-index selection.
  if (!filters.$text && (filters.companyKey || filters.locationKeys)) {
    options.hint = {
      status: 1,
      isPublicIndia: 1,
      ...(filters.companyKey ? { companyKey: 1 } : {}),
      ...(filters.locationKeys ? { locationKeys: 1 } : {}),
      sortDate: -1,
      _id: -1,
    };
  } else if (!filters.$text && sort !== "recommended") {
    // Broad pages need the ordered index too: trialling the many unrelated
    // indexes can consume the time budget before returning even the first page.
    // Mongo can scan the date index backwards for oldest-first navigation.
    options.hint = {
      status: 1,
      isPublicIndia: 1,
      ...(sort === "popularity" ? { clickCount: -1 } : {}),
      sortDate: -1,
      _id: -1,
    };
  }
  return options;
};

const executeNumberedJobQuery = async (execute, options) => {
  try {
    return await execute(options);
  } catch (error) {
    if (!options.hint || error?.code !== 2
      || !/hint provided does not correspond to an existing index/i.test(error.message)) {
      throw error;
    }
    // Older deployments and disposable test databases may not have these
    // indexes yet. Keep the original bounded query available in that case.
    const fallbackOptions = { ...options };
    delete fallbackOptions.hint;
    return execute(fallbackOptions);
  }
};

const jobFilters = (queryParams, options, siteSettings) => applyPublicJobVisibility(
  buildJobFilterConditions(queryParams, options), siteSettings,
);

const normalizeTerms = (
  values,
  { maxItems = MAX_RECOMMENDATION_TERMS, maxLength = MAX_REGEX_FILTER_LENGTH } = {},
) => {
  const list = Array.isArray(values) ? values : values ? [values] : [];
  return [...new Set(
    list
      .map((value) => normalizeFilterText(value, maxLength).toLowerCase())
      .filter(Boolean)
  )].slice(0, maxItems);
};

const hasPremiumJobFilters = (queryParams = {}) => (
  PREMIUM_FILTER_KEYS.some((key) => normalizeFilterText(queryParams[key]).length > 0)
  || (
    queryParams.sort !== undefined
    && queryParams.sort !== null
    && queryParams.sort !== ""
    && queryParams.sort !== "all"
  )
);

const hasScopedJobMetaFilters = (queryParams = {}) => (
  PREMIUM_FILTER_KEYS.some((key) => normalizeFilterText(queryParams[key]).length > 0)
);

const withoutQueryKeys = (queryParams = {}, excludedKeys = []) => {
  const excluded = new Set(excludedKeys);
  return Object.fromEntries(
    Object.entries(queryParams).filter(([key]) => !excluded.has(key)),
  );
};

const buildJobMetaFilter = (queryParams = {}, excludedKeys = [], extraFilters = {}, siteSettings) => (
  applyPublicJobVisibility({
    ...buildJobFilterConditions(withoutQueryKeys(queryParams, excludedKeys)),
    ...extraFilters,
  }, siteSettings)
);

const normalizeExperienceYearOptions = (values = []) => [...new Set(
  values
    .map((value) => Number.parseInt(String(value), 10))
    .filter((value) => (
      Number.isFinite(value)
      && value >= 0
      && value <= MAX_EXPERIENCE_FILTER_YEAR
    )),
)].sort((left, right) => left - right);

const resolveScopedDistinctValues = async (
  queryParams = {},
  field,
  excludedKeys = [],
  extraFilters = {},
  siteSettings,
) => Job.distinct(field, buildJobMetaFilter(queryParams, excludedKeys, extraFilters, siteSettings));

const resolveScopedExperienceYearOptions = async (queryParams = {}, siteSettings) => {
  const experienceYears = await Job.distinct(
    "experienceYears",
    buildJobMetaFilter(queryParams, ["experienceYear", "experienceBucket"], {}, siteSettings),
  );

  return normalizeExperienceYearOptions(experienceYears);
};

const filterSupportedOptions = (values = [], supportedOptions = []) => {
  const valueSet = new Set(values.map((value) => String(value || "").trim()).filter(Boolean));
  return supportedOptions.filter((option) => valueSet.has(option));
};

const resolveScopedDatePostedOptions = async (queryParams = {}, siteSettings) => {
  const baseConditions = buildJobFilterConditions(withoutQueryKeys(queryParams, ["datePostedDays"]));

  const matchesByWindow = await Promise.all(
    [...DATE_POSTED_WINDOW_OPTIONS, DATE_POSTED_OLDER_THAN_30_VALUE].map(async (days) => {
      const count = await Job.countDocuments(
        applyPublicJobVisibility({
          ...baseConditions,
          ...buildDatePostedFilter([days]),
        }, siteSettings),
      );

      return count > 0 ? days : null;
    }),
  );

  return matchesByWindow.filter((days) => days != null);
};

const getBranchKeywords = (branch) => {
  const value = String(branch || "").trim().toLowerCase();

  if (!value) return [];

  if (
    value.includes("cse") ||
    value.includes("computer") ||
    value === "it" ||
    value.includes("information technology")
  ) {
    return [
      "software",
      "software engineer",
      "developer",
      "backend",
      "frontend",
      "full stack",
      "data",
      "cloud",
      "platform",
      "devops",
      "automation",
      "java",
      "python",
      "react",
      "node.js",
      "machine learning",
      "ai",
      "web",
    ];
  }

  if (value.includes("ece") || value.includes("electronics")) {
    return [
      "embedded",
      "electronics",
      "firmware",
      "hardware",
      "vlsi",
      "fpga",
      "pcb",
      "avionics",
      "network",
      "telecom",
      "semiconductor",
    ];
  }

  if (value.includes("eee") || value.includes("electrical")) {
    return [
      "electrical",
      "electronics",
      "power",
      "embedded",
      "control",
      "automation",
      "plc",
      "energy",
      "grid",
      "hardware",
    ];
  }

  if (value.includes("mechanical")) {
    return [
      "mechanical",
      "design",
      "cad",
      "manufacturing",
      "production",
      "aircraft",
      "airframe",
      "propulsion",
      "thermal",
      "fluid",
      "simulation",
      "quality",
    ];
  }

  if (value.includes("civil")) {
    return [
      "civil",
      "construction",
      "structural",
      "infrastructure",
      "site",
      "geotechnical",
    ];
  }

  if (value.includes("chemical")) {
    return [
      "chemical",
      "process",
      "materials",
      "production",
      "quality",
      "safety",
      "polymer",
    ];
  }

  return [];
};

const buildTokenMatchExpression = (input, term) => ({
  $regexMatch: {
    input,
    regex: `(^|[^a-z0-9+#.])${escapeRegex(term)}([^a-z0-9+#.]|$)`,
  },
});

const buildRecommendationTextExpression = () => ({
  $toLower: {
    $concat: [
      { $ifNull: ["$title", ""] },
      " ",
      { $ifNull: ["$company", ""] },
      " ",
      { $ifNull: ["$department", ""] },
      " ",
      { $ifNull: ["$description", ""] },
      " ",
      {
        $reduce: {
          input: { $ifNull: ["$requiredSkills", []] },
          initialValue: "",
          in: { $concat: ["$$value", " ", { $ifNull: ["$$this", ""] }] },
        },
      },
      " ",
      {
        $reduce: {
          input: { $ifNull: ["$branches", []] },
          initialValue: "",
          in: { $concat: ["$$value", " ", { $ifNull: ["$$this", ""] }] },
        },
      },
    ],
  },
});

const buildRecommendationScoreExpression = (profile = {}) => {
  const preferredJobTypes = normalizeTerms(profile.preferredJobTypes, {
    maxItems: 4,
    maxLength: MAX_REGEX_FILTER_LENGTH,
  });
  const branchKeywords = normalizeTerms(getBranchKeywords(profile.branch))
    .filter((term) => !preferredJobTypes.includes(term));
  const preferredCities = normalizeTerms(profile.locationPreference)
    .filter((city) => city !== "none");
  const branch = profile.branch ? String(profile.branch).trim().toLowerCase() : "";
  const passingYear = Number(profile.passingYear);

  const scoreParts = [
    ...preferredJobTypes.map((jobType) => ({
      $cond: [
        {
          $in: [
            "$_jobTypeText",
            getPreferredJobTypeMatches(jobType).map((value) => value.toLowerCase()),
          ],
        },
        14,
        0,
      ],
    })),
    ...branchKeywords.map((keyword) => ({
      $cond: [buildTokenMatchExpression("$_recommendationText", keyword), 4, 0],
    })),
    ...preferredCities.map((city) => ({
      $cond: [
        {
          $or: [
            { $eq: ["$_cityText", city] },
            buildTokenMatchExpression("$_locationText", city),
          ],
        },
        5,
        0,
      ],
    })),
  ];

  if (branch) {
    scoreParts.push({
      $cond: [buildTokenMatchExpression("$_recommendationText", branch), 7, 0],
    });
  }

  if (Number.isFinite(passingYear)) {
    scoreParts.push({
      $cond: [
        { $in: [passingYear, { $ifNull: ["$eligibleBatches", []] }] },
        7,
        0,
      ],
    });
  }

  return scoreParts.length ? { $add: scoreParts } : 0;
};

const buildRecommendationPipeline = (filters, profile = {}, { skip = 0, limit = 0 } = {}) => {
  const pipeline = [
    { $match: filters },
    {
      $addFields: {
        _recommendationText: buildRecommendationTextExpression(),
        _jobTypeText: { $toLower: { $ifNull: ["$jobType", ""] } },
        _cityText: { $toLower: { $ifNull: ["$city", ""] } },
        _locationText: { $toLower: { $ifNull: ["$location", ""] } },
      },
    },
    {
      $addFields: {
        recommendationScore: buildRecommendationScoreExpression(profile),
      },
    },
    {
      $sort: {
        recommendationScore: -1,
        sortDate: -1,
        clickCount: -1,
        _id: -1,
      },
    },
  ];

  if (skip > 0) {
    pipeline.push({ $skip: skip });
  }

  if (limit > 0) {
    pipeline.push({ $limit: limit });
  }

  pipeline.push({
    $project: JOB_LIST_CARD_AGGREGATE_PROJECT,
  });

  return pipeline;
};

// Retrieves a paginated, filtered, and sorted list of active job listings.
export const getAllJobs = async (req, res) => {
  const startedAt = performance.now();
  const requestId = randomUUID();
  let queryPhase = "listings";
  try {
    res.set("X-Request-Id", requestId);
    res.set("Cache-Control", req.user ? PRIVATE_CACHE_HEADER : PUBLIC_CACHE_HEADER);
    res.set("Deprecation", "true");
    res.set("Link", '</api/jobs/search>; rel="successor-version"');
    const { page, limit, sort } = req.query;
    const hasPremiumAccess = canUsePremiumFilters(req.user, new Date(), req.siteSettings);

    if (!hasPremiumAccess && hasPremiumJobFilters(req.query)) {
      return res.status(403).json({
        success: false,
        premiumRequired: true,
        feature: "job_filters",
        message: "Filters are available on Jobverify Premium.",
      });
    }

    // Check effective selections before visibility wraps them in nested expressions.
    const filterConditions = buildJobFilterConditions(req.query);
    const filters = applyPublicJobVisibility(filterConditions, req.siteSettings);
    const hasTextSearch = Boolean(filters.$text);

    const pagination = parseLegacyJobPagination({ page, limit, sort });
    if (!pagination) {
      return res.status(400).json({ success: false,
        message: "Pagination exceeds the supported range. Use /api/jobs/search for deeper results." });
    }
    const { page: pageNum, limit: limitNum, offset: skip } = pagination;
    const queryOptions = resolveNumberedJobQueryOptions(filters, sort);

    const sortOption = resolveJobListSortOption({ sort, hasTextSearch });
    const canUseSummaryTotals = isDefaultPublicJobListFilter(filterConditions);
    const createJobsQuery = (options) => {
      if (sort === "recommended") {
        const recommendationPipeline = buildRecommendationPipeline(
          filters,
          req.user?.profile,
          { skip, limit: limitNum },
        );
        return Job.aggregate(recommendationPipeline, options);
      }
      return applyJobListProjection(Job.find(filters, null, options),
        { includeTextScore: hasTextSearch && !sort })
        .sort(sortOption).skip(skip).limit(limitNum).lean();
    };

    // Consume the query immediately: a fast rejection must not wait for the
    // summary before a handler is attached (Node treats it as process-fatal).
    const [jobs, summaryTotals] = await Promise.all([
      executeNumberedJobQuery(options => createJobsQuery(options).exec(), queryOptions),
      canUseSummaryTotals
        ? resolvePublicJobDatasetTotals(req.siteSettings, queryOptions).catch(() => null)
        : Promise.resolve(null),
    ]);
    if (summaryTotals) {
      return sendJobsResponse(res, jobs, pageNum, limitNum,
        summaryTotals.total, summaryTotals.totalCompanies);
    }
    queryPhase = "totals";
    const [total, companies] = await Promise.all([
      executeNumberedJobQuery(options => Job.countDocuments(filters, options), queryOptions).catch(error => {
        error.jobQueryPhase = "job_total";
        throw error;
      }),
      executeNumberedJobQuery(options => Job.distinct("company", filters, options), queryOptions).catch(error => {
        error.jobQueryPhase = "company_total";
        throw error;
      }),
    ]);

    return sendJobsResponse(
      res,
      jobs,
      pageNum,
      limitNum,
      total,
      new Set(companies.filter(Boolean)).size,
    );
  } catch (error) {
    if (error?.code === 50) {
      console.warn(JSON.stringify({
        event: "job_list_timeout", requestId,
        phase: error.jobQueryPhase || queryPhase,
        maxTimeMS: MAX_NUMBERED_QUERY_EXECUTION_MS,
        durationMs: Math.round(performance.now() - startedAt),
      }));
      return res.status(408).json({ code: "QUERY_TIMEOUT", success: false, requestId,
        message: "Jobs are taking longer than usual to load. Please try again shortly." });
    }
    console.error("Error in getAllJobs:", error);
    return res.status(500).json({
      code: 500,
      success: false,
      message: "Server error while fetching jobs",
    });
  }
};

const buildCursorBoundary = (cursor, sort) => {
  if (!cursor) return null;

  if (sort === "popularity") {
    return {
      $or: [
        { clickCount: { $lt: cursor.clickCount } },
        { clickCount: cursor.clickCount, sortDate: { $lt: cursor.cursorDate } },
        { clickCount: cursor.clickCount, sortDate: cursor.cursorDate, _id: { $lt: cursor.id } },
      ],
    };
  }

  const comparison = sort === "oldest" ? "$gt" : "$lt";
  return {
    $or: [
      { sortDate: { [comparison]: cursor.cursorDate } },
      { sortDate: cursor.cursorDate, _id: { [comparison]: cursor.id } },
    ],
  };
};

const buildCursorSort = (sort) => {
  if (sort === "oldest") {
    return { sortDate: 1, _id: 1 };
  }

  if (sort === "popularity") {
    return { clickCount: -1, sortDate: -1, _id: -1 };
  }

  return { sortDate: -1, _id: -1 };
};

const buildCursorSearchPipeline = ({ filters, boundary, sort, pageSize }) => {
  const pipeline = [{ $match: filters }];

  if (boundary) {
    pipeline.push({ $match: boundary });
  }

  pipeline.push(
    { $sort: buildCursorSort(sort) },
    { $limit: pageSize + 1 },
    { $project: JOB_LIST_CARD_AGGREGATE_PROJECT },
  );

  return pipeline;
};

/**
 * Cursor-based JSON search. The database receives one composed predicate and
 * returns at most pageSize + 1 documents, so application work is O(pageSize).
 */
export const getJobSearch = async (req, res) => {
  const startedAt = performance.now();
  const requestId = String(req.headers?.["x-request-id"] || "").trim() || randomUUID();
  try {
    res.set("Cache-Control", req.user ? PRIVATE_CACHE_HEADER : PUBLIC_CACHE_HEADER);
    res.set("X-Request-Id", requestId);
    const searchInput = req.method === "GET" ? req.query : req.body;
    const request = buildJobSearchRequest(searchInput);
    const hasPremiumAccess = canUsePremiumFilters(req.user, new Date(), req.siteSettings);

    if (!hasPremiumAccess && Object.keys(request.filters).length > 0) {
      return res.status(403).json({
        success: false,
        premiumRequired: true,
        feature: "job_filters",
        message: "Filters are available on Jobverify Premium.",
      });
    }

    const cursor = searchInput?.cursor ? decodeJobSearchCursor(searchInput.cursor, request) : null;
    const filters = jobFilters(request.filters, undefined, req.siteSettings);
    const boundary = buildCursorBoundary(cursor, request.sort);
    const pipeline = buildCursorSearchPipeline({
      filters,
      boundary,
      sort: request.sort,
      pageSize: request.pageSize,
    });
    const aggregate = Job.aggregate(pipeline);
    if (typeof aggregate.option === "function") {
      aggregate.option({ maxTimeMS: MAX_QUERY_EXECUTION_MS });
    }
    const rows = await aggregate.exec();
    const hasNextPage = rows.length > request.pageSize;
    const data = hasNextPage ? rows.slice(0, request.pageSize) : rows;
    const last = data.at(-1);
    const queryMs = Math.max(0, Math.round((performance.now() - startedAt) * 100) / 100);
    const nextCursor = hasNextPage && last
      ? encodeJobSearchCursor({
        filterHash: request.filterHash,
        sort: request.sort,
        cursorDate: last.sortDate,
        id: String(last._id),
        clickCount: last.clickCount,
      })
      : null;

    res.set("Server-Timing", `total;dur=${queryMs}`);
    if (!isProductionEnvironment()) {
      console.info(JSON.stringify({
        event: "job_search",
        requestId,
        queryShape: request.filterHash.slice(0, 12),
        durationMs: queryMs,
        returnedRows: data.length,
        pageSize: request.pageSize,
        hasNextPage,
      }));
    }
    return res.status(200).json({
      code: 200,
      success: true,
      data: data.map(normalizeJobListResponseJob),
      pagination: { limit: request.pageSize, hasNextPage, nextCursor },
      meta: {
        requestId,
        queryMs,
      },
    });
  } catch (error) {
    if (error instanceof SearchInputError) {
      return res.status(422).json({ success: false, ...error.toResponse() });
    }
    if (error?.name === "MongoServerError" && error?.code === 50) {
      return res.status(408).json({ code: "QUERY_TIMEOUT", success: false, message: "The search took too long. Narrow the filters and try again." });
    }
    console.error("Error in getJobSearch:", error);
    return res.status(500).json({ code: 500, success: false, message: "Server error while searching jobs" });
  }
};

// Retrieves a single job document by its unique ID.
export const getJobById = async (req, res) => {
  try {
    res.set("Cache-Control", PUBLIC_CACHE_HEADER);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: "Invalid job ID",
      });
    }

    const job = await Job.findOne(
      applyPublicJobVisibility({ _id: id, status: "active", $or: [{ closingDate: null }, { closingDate: { $gt: new Date() } }] }, req.siteSettings),
    );

    if (!job) {
      return res.status(404).json({
        code: 404,
        success: false,
        message: "Job not found",
      });
    }

    const responseJob = normalizeResponseJob(job.toObject ? job.toObject() : job);
    void scheduleWorkdayApplicationAvailabilityRefresh(responseJob);

    return res.status(200).json({
      code: 200,
      success: true,
      message: "Job retrieved successfully",
      data: responseJob,
    });
  } catch (error) {
    console.error("Error in getJobById:", error);
    return res.status(500).json({
      code: 500,
      success: false,
      message: "Server error while fetching job",
    });
  }
};

// Atomically increments click count and logs analytical click events.
export const trackJobClick = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: "Invalid job ID",
      });
    }

    const recentClickCutoff = new Date(Date.now() - CLICK_DEDUPE_WINDOW_MS);
    const userAgent = String(req.headers["user-agent"] || "").slice(0, 500);
    const clickQuery = req.user
      ? { job: id, user: req.user._id, clickedAt: { $gte: recentClickCutoff } }
      : { job: id, user: null, ip: req.ip, userAgent, clickedAt: { $gte: recentClickCutoff } };

    const existingClick = await Click.findOne(clickQuery).lean().exec();
    const publicJobFilter = applyPublicJobVisibility({ _id: id, status: "active" }, req.siteSettings);

    if (existingClick) {
      const existingJob = await Job.findOne(publicJobFilter).select("clickCount title company location city jobType applicationUrl applyUrl sourceUrl").lean().exec();
      if (!existingJob) {
        return res.status(404).json({
          code: 404,
          success: false,
          message: "Job not found",
        });
      }

      const application = req.user ? await recordApplicationOpen(req.user._id, existingJob) : null;
      return res.status(200).json({
        code: 200,
        success: true,
        message: "Job click already tracked",
        data: {
          jobId: existingJob._id,
          clickCount: existingJob.clickCount || 0,
          application,
        },
      });
    }

    const job = await Job.findOneAndUpdate(
      publicJobFilter,
      { $inc: { clickCount: 1 } },
      { new: true }
    );

    if (!job) {
      return res.status(404).json({
        code: 404,
        success: false,
        message: "Job not found",
      });
    }

    // cretes an anayltics record
    try {
      await Click.create({
        user: req.user ? req.user._id : null,
        job: job._id,
        ip: req.ip,
        userAgent,
      });
    } catch (clickErr) {
      console.error("Error creating Click record:", clickErr);
    }

    // A purge may finish between the job update and analytics insertion.
    if (!await Job.findOne({ _id: job._id }, '_id')) {
      await Click.deleteMany({ job: job._id });
      return res.status(404).json({ code: 404, success: false, message: 'Job not found' });
    }

    const application = req.user ? await recordApplicationOpen(req.user._id, job) : null;
    return res.status(200).json({
      code: 200,
      success: true,
      message: "Job click tracked",
      data: {
        jobId: job._id,
        clickCount: job.clickCount || 0,
        application,
      },
    });
  } catch (error) {
    console.error("Error in trackJobClick:", error);
    return res.status(500).json({
      code: 500,
      success: false,
      message: "Server error while tracking job click",
    });
  }
};

// Returns distinct active option groups to populate interdependent frontend filters.
export const getJobMeta = async (req, res) => {
  try {
    const queryParams = req.query ?? {};
    const hasScopedFilters = hasScopedJobMetaFilters(queryParams);

    res.set("Cache-Control", hasScopedFilters ? PRIVATE_CACHE_HEADER : PUBLIC_CACHE_HEADER);

    if (hasScopedFilters && !canUsePremiumFilters(req.user, new Date(), req.siteSettings)) {
      return res.status(403).json({
        success: false,
        premiumRequired: true,
        feature: "job_filters",
        message: "Filters are available on Jobverify Premium.",
      });
    }

    if (!hasScopedFilters) {
      const summary = await resolvePublicJobDatasetSummary(req.siteSettings).catch(() => null);

      if (summary != null) {
        return res.status(200).json({
        code: 200,
        success: true,
        message: "Job metadata retrieved successfully",
        data: {
          // The jobs page already has a dedicated autocomplete endpoint for companies.
          // Keep the base metadata payload compact and let the async loader fetch suggestions.
          companies: [],
          companyCount: Number(summary.totalCompanies ?? 0),
          cities: normalizePublicCityOptions(summary?.cities ?? []),
          jobTypes: [...new Set(
            (summary?.jobTypes ?? [])
                .map((jobTypeValue) => normalizeResponseJobType({ jobType: jobTypeValue }))
                .filter(Boolean)
            )].sort(),
            experienceYears: [...EXPERIENCE_FILTER_OPTIONS],
            experienceBuckets: EXPERIENCE_BUCKET_OPTIONS,
            skillMatchModes: SKILL_MATCH_MODE_OPTIONS,
            skillScopes: SKILL_SCOPE_OPTIONS,
            skills: SKILL_OPTIONS,
            roleDomains: ROLE_DOMAIN_OPTIONS,
            seniorityLevels: SENIORITY_LEVELS,
            workArrangements: WORK_ARRANGEMENT_OPTIONS,
            datePostedOptions: [...DATE_POSTED_WINDOW_OPTIONS, DATE_POSTED_OLDER_THAN_30_VALUE],
          },
        });
      }
    }

    const [
      companies,
      companyNames,
      cities,
      jobTypes,
      experienceYears,
      roleDomains,
      workArrangements,
      datePostedOptions,
    ] = await Promise.all([
      hasScopedFilters
        ? resolveActiveCompanyOptions(
          queryParams,
          {
            excludedKeys: ["company"],
            limit: DEFAULT_COMPANY_META_LIMIT,
            siteSettings: req.siteSettings,
          },
        )
        : Promise.resolve([]),
      Job.distinct('company', buildJobMetaFilter(
        queryParams, ['company'], { company: { $ne: null } }, req.siteSettings,
      )),
      hasScopedFilters
        ? resolveScopedDistinctValues(queryParams, "city", ["city", "location"], { city: { $ne: null } }, req.siteSettings)
        : Job.distinct("city", applyPublicJobVisibility({ status: "active", city: { $ne: null } }, req.siteSettings)),
      Job.aggregate([
          { $match: buildJobMetaFilter(queryParams, ["jobType"], { status: "active" }, req.siteSettings) },
          { $group: { _id: PUBLIC_JOB_TYPE_EXPRESSION } },
        ]).exec().then(rows => rows.map(row => row._id)),
      hasScopedFilters
        ? resolveScopedExperienceYearOptions(queryParams, req.siteSettings)
        : Promise.resolve(EXPERIENCE_FILTER_OPTIONS),
      hasScopedFilters
        ? resolveScopedDistinctValues(
          queryParams,
          "primaryRoleDomain",
          ["roleDomain"],
          { primaryRoleDomain: { $ne: null } },
          req.siteSettings,
        )
        : Promise.resolve(ROLE_DOMAIN_OPTIONS),
      hasScopedFilters
        ? Job.aggregate([
          { $match: buildJobMetaFilter(queryParams, ['workArrangement'], {}, req.siteSettings) },
          { $group: { _id: PUBLIC_WORK_ARRANGEMENT_EXPRESSION } },
        ]).exec().then(rows => rows.map(row => row._id))
        : Promise.resolve(WORK_ARRANGEMENT_OPTIONS),
      hasScopedFilters
        ? resolveScopedDatePostedOptions(queryParams, req.siteSettings)
        : Promise.resolve([...DATE_POSTED_WINDOW_OPTIONS, DATE_POSTED_OLDER_THAN_30_VALUE]),
    ]);

    return res.status(200).json({
      code: 200,
      success: true,
      message: "Job metadata retrieved successfully",
      data: {
        companies,
        companyCount: mergeCompanyOptions(companyNames).length,
        cities: normalizePublicCityOptions(cities),
        jobTypes: [...new Set(
        jobTypes
            .map((jobTypeValue) => normalizeResponseJobType({ jobType: jobTypeValue }))
            .filter(Boolean)
        )].sort(),
        experienceYears: hasScopedFilters ? experienceYears : [...EXPERIENCE_FILTER_OPTIONS],
        experienceBuckets: EXPERIENCE_BUCKET_OPTIONS,
        skillMatchModes: SKILL_MATCH_MODE_OPTIONS,
        skillScopes: SKILL_SCOPE_OPTIONS,
        skills: SKILL_OPTIONS,
        roleDomains: hasScopedFilters
          ? filterSupportedOptions(roleDomains, ROLE_DOMAIN_OPTIONS)
          : ROLE_DOMAIN_OPTIONS,
        seniorityLevels: SENIORITY_LEVELS,
        workArrangements: hasScopedFilters
          ? filterSupportedOptions(workArrangements.filter(value => value != null).map(normalizePublicWorkArrangement), WORK_ARRANGEMENT_OPTIONS)
          : WORK_ARRANGEMENT_OPTIONS,
        datePostedOptions,
      },
    });
  } catch (error) {
    console.error('Error in getJobMeta:', error);
    return res.status(500).json({
      code: 500,
      success: false,
      message: 'Server error while fetching job meta',
    });
  }
};

export const getJobCompanySuggestions = async (req, res) => {
  try {
    const queryParams = req.query ?? {};
    const hasScopedFilters = hasScopedJobMetaFilters(queryParams);

    res.set("Cache-Control", hasScopedFilters ? PRIVATE_CACHE_HEADER : PUBLIC_CACHE_HEADER);

    if (hasScopedFilters && !canUsePremiumFilters(req.user, new Date(), req.siteSettings)) {
      return res.status(403).json({
        success: false,
        premiumRequired: true,
        feature: "job_filters",
        message: "Filters are available on Jobverify Premium.",
      });
    }

    const summary = !hasScopedFilters
      ? await resolvePublicJobDatasetSummary(req.siteSettings).catch(() => null)
      : null;
    const summaryCompanies = mergeCompanyOptions(summary?.companies ?? []);
    const normalizedSearch = normalizeFilterText(queryParams.q).toLowerCase();
    const companies = summaryCompanies.length > 0
      ? summaryCompanies
        .filter((company) => !normalizedSearch || company.toLowerCase().includes(normalizedSearch))
        .slice(0, MAX_COMPANY_AUTOCOMPLETE_RESULTS)
      : await resolveActiveCompanyOptions(queryParams, {
        excludedKeys: ["company"],
        searchTerm: queryParams.q,
        limit: MAX_COMPANY_AUTOCOMPLETE_RESULTS,
        maximumLimit: MAX_COMPANY_AUTOCOMPLETE_RESULTS,
        siteSettings: req.siteSettings,
      });

    return res.status(200).json({
      code: 200,
      success: true,
      data: {
        companies,
      },
    });
  } catch (error) {
    console.error("Error in getJobCompanySuggestions:", error);
    return res.status(500).json({
      code: 500,
      success: false,
      message: "Server error while fetching company suggestions",
    });
  }
};

export const getLiveHiringCompanies = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const companies = await Job.distinct(
      "company",
      applyPublicJobVisibility({ status: "active" }, req.siteSettings),
    );

    return res.status(200).json({
      code: 200,
      success: true,
      data: {
        companies: mergeCompanyOptions(companies),
      },
    });
  } catch (error) {
    console.error("Error in getLiveHiringCompanies:", error);
    return res.status(500).json({
      code: 500,
      success: false,
      message: "Server error while fetching live hiring companies",
    });
  }
};

// Returns public summary counts for the landing page stats bar.
export const getJobStats = async (req, res) => {
  try {
    res.set("Cache-Control", PUBLIC_CACHE_HEADER);
    const summary = await resolvePublicJobDatasetSummary(req.siteSettings).catch(() => null);

    if (summary != null) {
      return res.status(200).json({
        code: 200,
        success: true,
        data: {
          totalJobs: Number(summary?.totalJobs ?? 0),
          totalCompanies: Number(summary?.totalCompanies ?? 0),
        },
      });
    }

    const [totalJobs, companies] = await Promise.all([
      Job.countDocuments(applyPublicJobVisibility({ status: "active" }, req.siteSettings)),
      Job.distinct("company", applyPublicJobVisibility({ status: "active" }, req.siteSettings)),
    ]);

    return res.status(200).json({
      code: 200,
      success: true,
      data: {
        totalJobs,
        totalCompanies: companies.filter(Boolean).length,
      },
    });
  } catch (error) {
    console.error('Error in getJobStats:', error);
    return res.status(500).json({
      code: 500,
      success: false,
      message: 'Server error while fetching job stats',
    });
  }
};

export const getJobSeoFeed = async (req, res) => {
  try {
    const frontendOrigin = resolveFrontendOrigin();
    res.set("Cache-Control", PUBLIC_CACHE_HEADER);

    const jobs = await Job.find(
      applyPublicJobVisibility({
        status: "active",
        sourceUrl: { $exists: true, $ne: null },
        description: { $type: 'string', $regex: /\S[\s\S]{118,}\S/ },
        $and: [{ $or: [{ closingDate: null }, { closingDate: { $gt: new Date() } }] }],
      }, req.siteSettings),
    )
      .sort({ sortDate: -1, _id: -1 })
      .select("title company postedAt updatedAt closingDate city location locations jobType sourceUrl applyUrl workdayApplicationStatus workdayApplicationStatusReason workdayApplicationStatusCheckedAt")
      .select({ _publicJobType: PUBLIC_JOB_TYPE_EXPRESSION })
      .lean()
      .exec();

    const data = jobs.filter(job => safeSourceUrl(job.sourceUrl) && buildApplicationState(job).applicationStatus === 'available').map((job) => {
      const path = `/jobs/${job._id}/${slugifyJob(job.title, job.company)}`;

      return {
        id: job._id,
        path,
        url: frontendOrigin ? `${frontendOrigin}${path}` : null,
        lastModified: job.updatedAt || job.postedAt || null,
        validThrough: job.closingDate || null,
        title: job.title,
        company: job.company,
        city: formatStoredLocationLabel(job) || null,
        jobType: normalizeResponseJobType(job),
      };
    });

    return res.status(200).json({
      code: 200,
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error in getJobSeoFeed:", error);
    return res.status(500).json({
      code: 500,
      success: false,
      message: "Server error while fetching job SEO feed",
    });
  }
};

export {
  JOB_CARD_PAGE_LIMIT,
  MAX_JOB_CARD_PAGE_LIMIT,
  JOB_LIST_CARD_PROJECTION,
  buildJobFilterConditions,
  buildJobMetaFilter,
  buildRecommendationPipeline,
  jobFilters as buildJobListFilters,
  resolveJobListSortOption,
};
