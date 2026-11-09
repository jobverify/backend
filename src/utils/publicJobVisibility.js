import { applyPublicJobLocationScope } from './publicJobLocationScope.js';
import { PUBLIC_JOB_TYPE_EXPRESSION } from './publicJobType.js';
import { PUBLIC_JOB_TYPES } from './publicJobTypeLabel.js';

// Use effective categories for public selections, including nested zero-year filters.
// Private inventory and ingestion continue to use the stored taxonomy.
const withPublicCategoryFilters = filters => {
  const result = Object.fromEntries(Object.entries(filters).map(([key, value]) => [
    key, ['$and', '$or', '$nor'].includes(key) ? value.map(withPublicCategoryFilters) : value,
  ]));
  const value = result.jobType;
  const predicate = typeof value === 'string' ? { $eq: [PUBLIC_JOB_TYPE_EXPRESSION, value] }
    : Array.isArray(value?.$in) ? { $in: [PUBLIC_JOB_TYPE_EXPRESSION, value.$in] }
      : value && Object.hasOwn(value, '$ne') ? { $ne: [PUBLIC_JOB_TYPE_EXPRESSION, value.$ne] } : null;
  if (!predicate) return result;
  delete result.jobType;
  result.$expr = result.$expr ? { $and: [result.$expr, predicate] } : predicate;
  return result;
};

export function applyPublicJobVisibility(filters = {}, siteSettings = {}, now = new Date()) {
  const visible = withPublicCategoryFilters(applyPublicJobLocationScope(filters, now));
  const categories = siteSettings.experiencedJobsEnabled === false
    ? PUBLIC_JOB_TYPES.filter(type => type !== 'Full-time Experienced') : PUBLIC_JOB_TYPES;
  return { ...visible, $expr: { $and: [visible.$expr, {
    $in: [PUBLIC_JOB_TYPE_EXPRESSION, categories],
  }] } };
}
