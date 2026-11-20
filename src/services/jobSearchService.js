import Job from '../models/Job.js';
import { canUsePremiumFilters } from '../utils/accessControl.js';
import { applyPublicJobVisibility } from '../utils/publicJobVisibility.js';
import { buildJobFilterConditions } from './jobFilterMatcher.js';
import { buildJobSearchRequest, decodeJobSearchCursor, encodeJobSearchCursor } from './jobSearchContract.js';
import { JOB_LIST_CARD_AGGREGATE_PROJECT } from '../utils/jobListCardFields.js';

export class PremiumJobFiltersError extends Error {
  constructor() {
    super('Filters are available on Jobverify Premium.');
    this.name = 'PremiumJobFiltersError';
    this.feature = 'job_filters';
  }
}

function cursorBoundary(cursor, sort) {
  if (!cursor) return null;
  if (sort === 'popularity') return { $or: [
    { clickCount: { $lt: cursor.clickCount } },
    { clickCount: cursor.clickCount, sortDate: { $lt: cursor.cursorDate } },
    { clickCount: cursor.clickCount, sortDate: cursor.cursorDate, _id: { $lt: cursor.id } },
  ] };
  const comparison = sort === 'oldest' ? '$gt' : '$lt';
  return { $or: [
    { sortDate: { [comparison]: cursor.cursorDate } },
    { sortDate: cursor.cursorDate, _id: { [comparison]: cursor.id } },
  ] };
}

// Shared execution only; both consumers use the existing public job serializer.
export async function searchJobs(input, { user, siteSettings } = {}) {
  const startedAt = performance.now();
  const request = buildJobSearchRequest(input);
  if (!canUsePremiumFilters(user, new Date(), siteSettings) && Object.keys(request.filters).length) {
    throw new PremiumJobFiltersError();
  }
  const cursor = input?.cursor ? decodeJobSearchCursor(input.cursor, request) : null;
  const filters = applyPublicJobVisibility(buildJobFilterConditions(request.filters), siteSettings);
  const boundary = cursorBoundary(cursor, request.sort);
  const sort = request.sort === 'oldest' ? { sortDate: 1, _id: 1 }
    : request.sort === 'popularity' ? { clickCount: -1, sortDate: -1, _id: -1 }
      : { sortDate: -1, _id: -1 };
  const pipeline = [{ $match: filters }, ...(boundary ? [{ $match: boundary }] : []),
    { $sort: sort }, { $limit: request.pageSize + 1 }, { $project: JOB_LIST_CARD_AGGREGATE_PROJECT }];
  const aggregate = Job.aggregate(pipeline);
  if (typeof aggregate.option === 'function') aggregate.option({ maxTimeMS: 800 });
  const rows = await aggregate.exec();
  const hasNextPage = rows.length > request.pageSize;
  const data = hasNextPage ? rows.slice(0, request.pageSize) : rows;
  const last = data.at(-1);
  const nextCursor = hasNextPage && last ? encodeJobSearchCursor({
    filterHash: request.filterHash, sort: request.sort,
    cursorDate: last.sortDate, id: String(last._id), clickCount: last.clickCount,
  }) : null;
  return { data, pagination: { limit: request.pageSize, hasNextPage, nextCursor },
    queryMs: Math.max(0, Math.round((performance.now() - startedAt) * 100) / 100),
    filterHash: request.filterHash };
}
