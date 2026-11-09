// Identifies the historic aggregate rows emitted by directory adapters. Require
// both the synthetic title and ID so ordinary vacancies are unaffected.
const AGGREGATE_TITLE = /^Current (?:remote )?openings at\s/i;
const AGGREGATE_ID = /-current-openings$/i;

export const isAggregateHiringSignalJob = (job = {}) => AGGREGATE_TITLE.test(job.title || '')
  && [job.jobId, job.requisitionId].some((id) => AGGREGATE_ID.test(id || ''));

export const buildAggregateHiringSignalFilter = () => ({
  title: AGGREGATE_TITLE,
  $or: [{ jobId: AGGREGATE_ID }, { requisitionId: AGGREGATE_ID }],
});
