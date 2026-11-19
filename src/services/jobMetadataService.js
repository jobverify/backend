import Job from '../models/Job.js';
import { buildJobFilterConditions } from './jobFilterMatcher.js';
import { applyPublicJobVisibility, withPublicCategoryFilters } from '../utils/publicJobVisibility.js';
import { PUBLIC_JOB_TYPE_EXPRESSION } from '../utils/publicJobType.js';
import { PUBLIC_WORK_ARRANGEMENT_EXPRESSION } from '../utils/publicWorkArrangement.js';
import { CALENDAR_POSTED_PERIODS, buildPostedDateRange } from '../utils/jobPostedDateFilter.js';

// These dimensions exclude their own selections when listing alternatives.
const DIMENSION_KEYS = new Set(['company', 'city', 'location', 'jobType', 'experienceYear',
  'experienceBucket', 'roleDomain', 'workArrangement', 'datePostedDays']);
const POSTED_WINDOWS = [0, 1, ...CALENDAR_POSTED_PERIODS];
const without = (query, excluded) => Object.fromEntries(Object.entries(query).filter(([key]) => !excluded.includes(key)));

// Reuse the effective labels in every facet, including nested zero-year filters.
// Preserve dates and regular expressions as BSON values rather than JSON-cloning.
const computedLabels = value => {
  if (value === PUBLIC_JOB_TYPE_EXPRESSION) return '$_metadataJobType';
  if (value === PUBLIC_WORK_ARRANGEMENT_EXPRESSION) return '$_metadataWorkArrangement';
  if (Array.isArray(value)) return value.map(computedLabels);
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, computedLabels(child)]));
  }
  return value;
};

export const jobMetadataCacheKey = (query, settings = {}) => JSON.stringify([
  settings.billingEnabled === true, settings.experiencedJobsEnabled !== false,
  buildJobFilterConditions(query),
], (_key, value) => value instanceof RegExp ? { regex: value.source, flags: value.flags } : value);

export async function readScopedJobMetadata(query, settings, companyPipeline) {
  const dimensions = Object.fromEntries(Object.entries(query).filter(([key]) => DIMENSION_KEYS.has(key)));
  const common = Object.fromEntries(Object.entries(query).filter(([key]) => !DIMENSION_KEYS.has(key)));
  const { $expr, ...indexedScope } = applyPublicJobVisibility(buildJobFilterConditions(common), settings);
  const match = (excluded, extra = {}) => ({ $match: computedLabels(withPublicCategoryFilters({
    ...buildJobFilterConditions(without(dimensions, excluded)), ...extra,
  })) });
  const distinct = (field, excluded, extra) => [match(excluded, extra),
    { $unwind: '$' + field }, { $group: { _id: '$' + field } }];
  const now = new Date();
  const dateFlags = Object.fromEntries(POSTED_WINDOWS.map((value, index) => {
    const range = buildPostedDateRange(value, now);
    return ['window' + index, { $max: { $cond: [{ $and: [
      { $eq: [{ $type: '$postedAt' }, 'date'] },
      { $gte: ['$postedAt', range.$gte] }, { $lt: ['$postedAt', range.$lt] },
    ] }, 1, 0] } }];
  }));
  const [result = {}] = await Job.aggregate([
    { $match: indexedScope },
    { $set: { _metadataJobType: PUBLIC_JOB_TYPE_EXPRESSION, _metadataWorkArrangement: PUBLIC_WORK_ARRANGEMENT_EXPRESSION } },
    { $match: { $expr: computedLabels($expr) } },
    { $facet: {
      companies: [match(['company'], { company: { $ne: null } }), ...companyPipeline.slice(1)],
      companyNames: distinct('company', ['company'], { company: { $ne: null } }),
      cities: distinct('city', ['city', 'location'], { city: { $ne: null } }),
      jobTypes: [match(['jobType']), { $group: { _id: '$_metadataJobType' } }],
      experienceYears: distinct('experienceYears', ['experienceYear', 'experienceBucket']),
      roleDomains: distinct('primaryRoleDomain', ['roleDomain'], { primaryRoleDomain: { $ne: null } }),
      workArrangements: [match(['workArrangement']), { $group: { _id: '$_metadataWorkArrangement' } }],
      dateWindows: [match(['datePostedDays']), { $group: { _id: null, ...dateFlags } }],
    } },
  ], { maxTimeMS: 5000 }).exec();
  const values = field => (result[field] ?? []).map(row => row._id);
  const years = [...new Set(values('experienceYears').map(value => Number.parseInt(String(value), 10))
    .filter(value => Number.isFinite(value) && value >= 0 && value <= 15))].sort((left, right) => left - right);
  return [
    (result.companies ?? []).map(row => row.company), values('companyNames'), values('cities'),
    values('jobTypes'), years, values('roleDomains'), values('workArrangements'),
    POSTED_WINDOWS.filter((_value, index) => result.dateWindows?.[0]?.['window' + index] === 1),
  ];
}
