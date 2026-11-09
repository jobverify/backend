import { buildAggregateHiringSignalFilter } from './jobListingEvidence.js';
import { buildMissingSourceDescriptionFilter } from './jobSourceContent.js';
import { buildPublicJobLifecycleDateScope } from './publicJobLocationScope.js';
import { applyPublicJobVisibility } from './publicJobVisibility.js';
import { PUBLIC_JOB_TYPE_EXPRESSION } from './publicJobType.js';
import { PUBLIC_JOB_TYPES } from './publicJobTypeLabel.js';

export const MAX_PUBLICATION_DIAGNOSTIC_JOBS = 5000;

// Evaluate independent blockers in Mongo using the same predicates as the public
// query. A single aggregate keeps the visible IDs and their explanations aligned.
export function buildPublicationDiagnosticPipeline({ sources, siteSettings = {}, now = new Date() } = {}) {
  if (!Array.isArray(sources) || !sources.length || sources.length > 100
    || sources.some(source => typeof source !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,127}$/i.test(source))) {
    throw new TypeError('Provide between 1 and 100 valid source IDs');
  }
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new TypeError('A valid reference date is required');
  const checks = {
    inactive: { status: 'active' },
    outside_india_scope: { isPublicIndia: true },
    unclassified_job_type: { $expr: { $in: [PUBLIC_JOB_TYPE_EXPRESSION, PUBLIC_JOB_TYPES] } },
    missing_source_description: { $nor: [buildMissingSourceDescriptionFilter()] },
    aggregate_hiring_signal: { $nor: [buildAggregateHiringSignalFilter()] },
    outside_publication_window_or_closed: buildPublicJobLifecycleDateScope(now),
  };
  if (siteSettings.experiencedJobsEnabled === false) {
    checks.experienced_jobs_disabled = { $expr: {
      $not: [{ $in: [PUBLIC_JOB_TYPE_EXPRESSION, ['Full-time Experienced', 'Full-time']] }],
    } };
  }
  const ids = [{ $project: { _id: 1 } }];
  return [
    { $match: { source: { $in: [...new Set(sources)] } } },
    { $sort: { _id: 1 } },
    { $limit: MAX_PUBLICATION_DIAGNOSTIC_JOBS + 1 },
    { $facet: {
      jobs: [{ $project: {
        source: 1, title: 1, company: 1, jobId: 1, sourceUrl: 1, applyUrl: 1,
        status: 1, isPublicIndia: 1, postedAt: 1, closingDate: 1,
        jobType: 1, publicJobType: PUBLIC_JOB_TYPE_EXPRESSION,
      } }],
      visible: [{ $match: applyPublicJobVisibility({ status: 'active' }, siteSettings, now) }, ...ids],
      ...Object.fromEntries(Object.entries(checks).map(([reason, query]) => [
        reason, [{ $match: { $nor: [query] } }, ...ids],
      ])),
    } },
  ];
}

export function summarizePublicationDiagnostics(result, { sources, siteSettings = {}, now = new Date() } = {}) {
  const allJobs = result?.jobs || [];
  const truncated = allJobs.length > MAX_PUBLICATION_DIAGNOSTIC_JOBS;
  const visible = new Set((result?.visible || []).map(row => String(row._id)));
  const blockers = Object.entries(result || {}).filter(([key]) => !['jobs', 'visible'].includes(key))
    .map(([reason, values]) => [reason, new Set(values.map(row => String(row._id)))]);
  const jobs = allJobs.slice(0, MAX_PUBLICATION_DIAGNOSTIC_JOBS).map(job => {
    const id = String(job._id);
    const blockingReasons = blockers.filter(([, ids]) => ids.has(id)).map(([reason]) => reason);
    if (!visible.has(id) && !blockingReasons.length) blockingReasons.push('unclassified_visibility_rule');
    return { ...job, _id: id, visible: visible.has(id), blockingReasons };
  });
  const rows = [...new Set(sources)].map(source => {
    const selected = jobs.filter(job => job.source === source);
    const reasonCounts = {};
    for (const job of selected) for (const reason of job.blockingReasons) reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    return { source, savedJobs: truncated ? null : selected.length,
      visibleJobs: truncated ? null : selected.filter(job => job.visible).length,
      observedJobs: selected.length, blockingReasonCounts: reasonCounts };
  });
  return { schemaVersion: 1, generatedAt: now.toISOString(), databaseAvailable: true,
    readOnly: true, truncated, countsComplete: !truncated, siteSettings, sources: rows, jobs };
}
