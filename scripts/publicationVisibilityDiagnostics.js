import { applyPublicJobVisibility } from '../src/utils/publicJobVisibility.js';
import { buildPublicJobLifecycleDateScope } from '../src/utils/publicJobLocationScope.js';
import { buildAggregateHiringSignalFilter } from '../src/utils/jobListingEvidence.js';
import { buildMissingSourceDescriptionFilter } from '../src/utils/jobSourceContent.js';
import { buildPublishableJobPostedAtCutoff } from '../src/utils/jobLifecycle.js';
import { PUBLIC_JOB_TYPE_EXPRESSION } from '../src/utils/publicJobType.js';

export const normalizeDiagnosticSources = sources => {
  if (!Array.isArray(sources) || sources.length === 0) throw new TypeError('A non-empty diagnostic source array is required');
  if (sources.some(source => typeof source !== 'string' || !source.trim() || source !== source.trim())) {
    throw new TypeError('Each diagnostic source must be a non-empty, unpadded string');
  }
  return [...new Set(sources)].sort();
};

// Every failure is evaluated by Mongo against the same component predicates as
// the public query. Do not infer isPublicIndia from city/country, hydrate model
// defaults, parse dates in JavaScript, or substitute the stored jobType here.
const visibilityRules = (siteSettings, now) => {
  const lifecycle = buildPublicJobLifecycleDateScope(now).$expr.$and;
  const closing = { $or: [{ closingDate: null }, { closingDate: { $gt: now } }] };
  const publicFilter = applyPublicJobVisibility({ status: 'active', ...closing }, siteSettings, now);
  const fails = filter => ({ $nor: [filter] });
  return { publicFilter, rules: [
    { code: 'status-not-active', filter: fails({ status: 'active' }),
      action: 'Inspect the stored lifecycle status and current first-party vacancy; republish only after the normal ingestion rules establish active status.' },
    { code: 'not-marked-public-india', filter: fails({ isPublicIndia: true }),
      action: 'Inspect stored India worksite evidence and the ingestion location decision; city text alone does not satisfy the public predicate.' },
    { code: 'aggregate-hiring-signal', filter: buildAggregateHiringSignalFilter(),
      action: 'Replace a synthetic openings summary with independently evidenced vacancy records through the normal scraper.' },
    { code: 'source-description-missing', filter: buildMissingSourceDescriptionFilter(),
      action: 'Recover actual employer description content; generated display copy cannot replace empty immutable source content.' },
    { code: 'closing-date-not-open', filter: fails({ $and: [closing, { $expr: lifecycle[1] }] }),
      action: 'Verify closingDate and the current employer vacancy. A closing date equal to the audit time is already closed.' },
    { code: 'posted-at-in-future', filter: fails({ $expr: lifecycle[0] }),
      action: 'Verify the employer posting date and date parsing. Keep an accurately future-dated vacancy unpublished until its posting time.' },
    { code: 'posted-at-before-public-window', filter: fails({ $expr: lifecycle[2] }),
      action: 'Verify the employer posting date. Storage retention and the one-calendar-month public window are independent; do not refresh dates without source evidence.' },
    { code: 'public-category-not-enabled', filter: fails({ $expr: publicFilter.$expr.$and[1] }),
      action: 'Inspect the effective public category in the samples and experiencedJobsEnabled. Use source-backed classification; do not broaden allowed categories to clear the gap.' },
  ] };
};

export async function collectPublicationVisibilityDiagnostics({ database, sources, siteSettings, now }) {
  sources = normalizeDiagnosticSources(sources);
  const { publicFilter, rules } = visibilityRules(siteSettings, now);
  const count = filter => [{ $match: filter }, { $group: { _id: '$source', count: { $sum: 1 } } }];
  const sample = {
    id: { $convert: { input: '$_id', to: 'string', onError: null, onNull: null } },
    jobId: '$jobId', title: '$title', status: '$status', isPublicIndia: '$isPublicIndia',
    postedAt: '$postedAt', closingDate: '$closingDate', storedJobType: '$jobType', publicJobType: PUBLIC_JOB_TYPE_EXPRESSION,
  };
  const excluded = { $nor: [publicFilter] };
  const facets = {
    saved: [{ $group: { _id: '$source', count: { $sum: 1 } } }],
    visible: count(publicFilter),
    excluded: count(excluded),
    unexplained: count({ $and: [excluded, { $nor: rules.map(rule => rule.filter) }] }),
    ...Object.fromEntries(rules.map((rule, index) => [`rule${index}`, [
      { $match: rule.filter },
      { $group: { _id: '$source', count: { $sum: 1 }, samples: { $firstN: { input: sample, n: 3 } } } },
    ]])),
  };
  const [result] = await database.collection('jobs').aggregate([
    { $match: { source: { $in: sources } } },
    { $sort: { source: 1, _id: 1 } },
    { $facet: facets },
  ], { maxTimeMS: 30000, allowDiskUse: true }).toArray();
  const indexed = Object.fromEntries(Object.entries(result).map(([facet, rows]) => [facet, new Map(rows.map(row => [row._id, row]))]));
  const countFor = (facet, source) => indexed[facet].get(source)?.count ?? 0;
  return {
    schemaVersion: 1, generatedAt: now.toISOString(), reasonsOverlap: true,
    publicPostedAtCutoff: buildPublishableJobPostedAtCutoff(now).toISOString(),
    sampleLimitPerReasonAndSource: 3,
    rules: rules.map(({ code, action }) => ({ code, action })),
    sources: sources.map(source => {
      const savedJobs = countFor('saved', source);
      const visibleJobs = countFor('visible', source);
      const excludedJobs = countFor('excluded', source);
      const unexplainedExcludedJobs = countFor('unexplained', source);
      const reasonCounts = Object.fromEntries(rules.map((rule, index) => [rule.code, countFor(`rule${index}`, source)]));
      return {
        source, savedJobs, visibleJobs, excludedJobs, unexplainedExcludedJobs,
        complete: savedJobs === visibleJobs + excludedJobs && unexplainedExcludedJobs === 0
          && Object.values(reasonCounts).every(value => value <= excludedJobs),
        reasonCounts,
        reasonSamples: Object.fromEntries(rules.map((rule, index) => [rule.code, indexed[`rule${index}`].get(source)?.samples ?? []])),
      };
    }),
  };
}

const metric = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const validTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
export const publicationAuditSources = report => normalizeDiagnosticSources((report?.rows ?? [])
  .filter(row => row.gapExplanation === 'saved-jobs-not-public-rule-inspection-required' && row.savedJobs > 0 && row.visibleJobs === 0)
  .map(row => row.source));

// Old aggregate snapshots establish inventory totals, never the reason a job
// failed publication. Only complete, fresh, internally consistent diagnostic
// observations may supply reason counts. Scraper rejection counters are not
// consulted: they describe an ingestion attempt, not these stored documents.
export function buildPublicationVisibilityAudit({ report, snapshot, now = new Date(), maxAgeHours = 48 }) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()) || !(maxAgeHours > 0)) throw new TypeError('Valid now and positive maxAgeHours required');
  const sources = publicationAuditSources(report);
  const baseline = new Map(report.rows.map(row => [row.source, row]));
  const inventoryAvailable = snapshot?.databaseAvailable === true && Array.isArray(snapshot.inventory)
    && snapshot.inventory.every(row => row && (typeof row.source === 'string' || row.source === null) && metric(row.savedJobs) !== null
      && metric(row.visibleJobs) !== null && row.visibleJobs <= row.savedJobs)
    && new Set(snapshot.inventory.map(row => row.source)).size === snapshot.inventory.length;
  const inventory = new Map((inventoryAvailable ? snapshot.inventory : []).map(row => [row.source, row]));
  const diagnostics = snapshot?.publicationDiagnostics;
  const { rules } = visibilityRules(snapshot?.siteSettings ?? {}, now);
  const codes = rules.map(rule => rule.code);
  const diagnosticAt = validTime(diagnostics?.generatedAt) ? new Date(diagnostics.generatedAt) : null;
  const fresh = diagnosticAt && diagnosticAt <= now && now - diagnosticAt <= maxAgeHours * 3600000;
  const envelopeValid = diagnostics?.schemaVersion === 1 && diagnostics.reasonsOverlap === true
    && diagnostics.generatedAt === snapshot?.generatedAt && fresh
    && diagnostics.publicPostedAtCutoff === buildPublishableJobPostedAtCutoff(diagnosticAt).toISOString()
    && Array.isArray(diagnostics.rules) && diagnostics.rules.length === codes.length
    && diagnostics.rules.every(rule => rule && typeof rule.code === 'string')
    && codes.every(code => diagnostics.rules.filter(rule => rule.code === code).length === 1)
    && Array.isArray(diagnostics.sources)
    && diagnostics.sources.every(row => row && typeof row.source === 'string')
    && new Set(diagnostics.sources.map(row => row?.source)).size === diagnostics.sources.length;
  const diagnosed = new Map((envelopeValid ? diagnostics.sources : []).map(row => [row.source, row]));
  const rows = sources.map(source => {
    const stored = inventory.get(source);
    const observed = {
      snapshotAt: snapshot?.generatedAt ?? null,
      savedJobs: inventoryAvailable ? stored?.savedJobs ?? 0 : null,
      visibleJobs: inventoryAvailable ? stored?.visibleJobs ?? 0 : null,
    };
    const candidate = diagnosed.get(source);
    const complete = inventoryAvailable && candidate?.complete === true
      && metric(candidate.savedJobs) !== null && metric(candidate.visibleJobs) !== null
      && metric(candidate.excludedJobs) !== null && candidate.unexplainedExcludedJobs === 0
      && candidate.savedJobs === observed.savedJobs && candidate.visibleJobs === observed.visibleJobs
      && candidate.savedJobs === candidate.visibleJobs + candidate.excludedJobs
      && candidate.reasonCounts && Object.keys(candidate.reasonCounts).length === codes.length
      && codes.every(code => metric(candidate.reasonCounts[code]) !== null && candidate.reasonCounts[code] <= candidate.excludedJobs
        && Array.isArray(candidate.reasonSamples?.[code]) && candidate.reasonSamples[code].length <= Math.min(3, candidate.reasonCounts[code])
        && (candidate.reasonCounts[code] === 0 || candidate.reasonSamples[code].length > 0))
      && Object.values(candidate.reasonCounts).reduce((sum, count) => sum + count, 0) >= candidate.excludedJobs;
    const unknownReason = !inventoryAvailable ? 'database-inventory-unavailable'
      : !diagnostics ? 'job-level-diagnostics-not-collected'
        : !envelopeValid ? 'diagnostic-observation-stale-or-invalid'
          : !candidate ? 'source-not-diagnosed' : !complete ? 'diagnostic-counts-incomplete-or-inconsistent' : null;
    const reasonCounts = complete ? candidate.reasonCounts : null;
    const primaryReason = complete ? codes.filter(code => reasonCounts[code] > 0)
      .sort((left, right) => reasonCounts[right] - reasonCounts[left])[0] ?? null : null;
    return {
      source, companyName: baseline.get(source).companyName ?? null,
      archived: { snapshotAt: report.summary?.runtimeSnapshotAt ?? report.generatedAt ?? null,
        savedJobs: metric(baseline.get(source).savedJobs), visibleJobs: metric(baseline.get(source).visibleJobs) },
      observed, diagnosis: complete ? 'verified' : 'unknown', unknownReason, primaryReason,
      action: primaryReason ? rules.find(rule => rule.code === primaryReason).action
        : complete ? 'No failed public rule observed for this source at the diagnostic time.'
          : 'Collect a fresh read-only diagnostic snapshot for this source before attributing a publication reason.',
      excludedJobs: complete ? candidate.excludedJobs : null,
      unexplainedExcludedJobs: complete ? candidate.unexplainedExcludedJobs : null,
      reasonCounts, reasonSamples: complete ? candidate.reasonSamples : null,
    };
  });
  const verified = rows.filter(row => row.diagnosis === 'verified');
  return {
    schemaVersion: 1, generatedAt: now.toISOString(), databaseAvailable: snapshot?.databaseAvailable === true,
    diagnosticSnapshotAt: diagnostics?.generatedAt ?? null, siteSettings: snapshot?.siteSettings ?? null,
    sourceSelection: 'The input coverage report rows with saved-jobs-not-public-rule-inspection-required, savedJobs > 0 and visibleJobs === 0.',
    reasonsOverlap: true, rules: rules.map(({ code, action }) => ({ code, action })),
    summary: {
      targetSources: rows.length,
      archivedSavedJobs: rows.reduce((sum, row) => sum + row.archived.savedJobs, 0),
      archivedVisibleJobs: rows.reduce((sum, row) => sum + row.archived.visibleJobs, 0),
      observedSavedJobs: inventoryAvailable ? rows.reduce((sum, row) => sum + row.observed.savedJobs, 0) : null,
      observedVisibleJobs: inventoryAvailable ? rows.reduce((sum, row) => sum + row.observed.visibleJobs, 0) : null,
      verifiedReasonSources: verified.length, unknownReasonSources: rows.length - verified.length,
      reasonTotalsFromVerifiedSources: verified.length ? Object.fromEntries(codes.map(code => [code,
        verified.reduce((sum, row) => sum + row.reasonCounts[code], 0)])) : null,
    },
    limitations: [
      'Archived counts and diagnostic observations are separate points in time; current evidence cannot reconstruct historical exclusion reasons.',
      'Reasons overlap. Never sum reason counts to calculate excluded jobs; excludedJobs is counted with the exact complete public query.',
      'Samples are bounded to three jobs per reason and source; they identify follow-up records and are not exhaustive.',
      'Persisted isPublicIndia and effective public categories determine query eligibility. This audit does not change flags, dates, classifications, settings or jobs.',
      'Historical scraper attempt counters and scraper success do not establish the publication eligibility of stored jobs.',
    ],
    rows,
  };
}
