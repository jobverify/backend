import { stageOutcome } from '../src/pipeline/policy.js';
import { validateRewriteShard } from './partitioning.js';
import { summarizeRewriteCapacity } from './capacity.js';
export { summarizeRewriteCapacity } from './capacity.js';

/** A publication count is not a count of successful wording rewrites. */
export function formatRewriteReport(summary = {}) {
  const capacity = summary.capacity || {};
  const count = value => Number.isFinite(value) ? String(value) : 'Not measured';
  const rate = (value, fraction) => Number.isFinite(fraction) ? `${count(value)} (${(fraction * 100).toFixed(1)}%)` : 'Not measured';
  const wordingMeasured = summary.published > 0 && capacity.wordingMetricsRecordedDescriptions === summary.published;
  const rows = [
    ['Queued', count(summary.queued)], ['Published', count(summary.published)],
    ['Pending estimate', count(summary.pendingEstimate)], ['Interrupted attempts', count(summary.interruptedAttempts)],
    ['Wording edits', wordingMeasured ? rate(capacity.modelWordingEditedDescriptions, capacity.modelWordingEditRate) : 'Not measured'],
    ['Model layout edits only', wordingMeasured ? rate(capacity.modelLayoutOnlyDescriptions, capacity.modelLayoutOnlyRate) : 'Not measured'],
    ['Published with source fallback', count(summary.sourceFallbackDescriptions)],
    ['Correction acceptance', rate(capacity.correctionsAccepted, capacity.correctionAcceptanceRate)],
    ['Peak active processing runners', count(capacity.peakActiveRunners)], ['Processing runner hours', count(capacity.runnerHours)],
    ['Published per processing runner hour', count(capacity.publishedPerRunnerHour)],
  ];
  return `## Description rewrite results\n\nProcessing: ${summary.processingStatus || 'not measured'}; handoff: ${summary.handoffReady ? 'ready' : 'not ready'}.\n\n`
    + '| Metric | Result |\n| --- | --- |\n' + rows.map(([label, value]) => `| ${label} | ${value} |`).join('\n')
    + '\n\nPublished includes validated source fallback and formatting. Wording edits are measured changes, not a semantic quality score. '
    + 'Runner timings cover rewrite processing only; they exclude setup and artifact upload and are not billed runner usage.\n';
}

const counters = ['queued', 'attempted', 'published', 'failed', 'skipped', 'queueRepairs',
  'staleSources', 'concurrentChanges', 'sourceFallbackDescriptions', 'sourceFallbackBlocks',
  'warnings', 'pendingEstimate', 'stale', 'interruptedAttempts'];
const flags = ['interrupted', 'budgetExhausted', 'qualityStopped', 'cancelled'];

const validWorkerSummary = part => {
  // A preview is the final artifact only when there was no work to apply.
  if (part.mode === 'preview') return part.queued === 0 && part.reason === 'read_only_preview' && part.outcome === undefined;
  if (!['completed', 'failed', 'incomplete'].includes(part.outcome)) return false;
  if (part.mode === 'off') return part.reason === 'disabled' && part.outcome === 'failed';
  if (part.mode !== 'publish') return false;
  if (part.queued !== undefined) return part.pendingEstimate !== undefined;
  // A stop before connecting/counting has no queue count, but must explain why.
  return (part.reason === 'worker_error' && typeof part.errorType === 'string' && part.errorType.length > 0)
    || (part.reason === 'workflow_budget_exhausted' && part.interrupted === true
      && part.budgetExhausted === true && part.stopReason === 'budget_exhausted')
    || (part.reason === 'interrupted' && part.interrupted === true
      && part.cancelled === true && part.stopReason === 'cancelled');
};

/** Aggregate disjoint runner queues without duplicating their per-job results. */
export function aggregateRewriteSummaries(parts, { shardCount = 4 } = {}) {
  if (!Array.isArray(parts)) {
    throw new Error('Invalid rewrite shard summaries');
  }
  validateRewriteShard(0, shardCount);
  const summary = { shardCount, ...Object.fromEntries(counters.map(key => [key, 0])),
    ...Object.fromEntries(flags.map(key => [key, false])), workers: [], missingShards: [],
    failedShards: [], incompleteShards: [] };
  const seen = new Set();
  for (const part of parts) {
    if (!part || part.shardCount !== shardCount || !Number.isSafeInteger(part.shard)
      || part.shard < 0 || part.shard >= shardCount || seen.has(part.shard)) {
      throw new Error('Invalid or duplicate rewrite shard identity');
    }
    if (!validWorkerSummary(part)) throw new Error('Invalid rewrite shard summary');
    seen.add(part.shard);
    for (const key of counters) {
      if (part[key] === undefined) continue;
      if (typeof part[key] !== 'number' || !Number.isFinite(part[key]) || part[key] < 0) {
        throw new Error('Invalid rewrite shard counter: ' + key);
      }
      summary[key] += part[key];
    }
    for (const key of flags) summary[key] ||= part[key] === true;
    if (part.mode === 'publish') summary.mode = 'publish';
    else summary.mode ??= part.mode;
    for (const key of ['modelId', 'modelFile', 'modelRevision', 'policyVersion', 'outputFormat']) {
      if (part[key] !== undefined && summary[key] !== undefined && part[key] !== summary[key]) {
        throw new Error('Mismatched rewrite shard model or policy identity');
      }
      if (part[key] !== undefined) summary[key] ??= part[key];
    }
    if (Number.isFinite(Date.parse(part.startedAt))
      && (!summary.startedAt || Date.parse(part.startedAt) < Date.parse(summary.startedAt))) summary.startedAt = part.startedAt;
    if (Number.isFinite(Date.parse(part.finishedAt))
      && (!summary.finishedAt || Date.parse(part.finishedAt) > Date.parse(summary.finishedAt))) summary.finishedAt = part.finishedAt;
    const { results: _results, ...worker } = part;
    summary.workers.push(worker);
    const outcome = stageOutcome('rewrite', part, part.outcome === 'failed' ? 1 : 0);
    if (outcome === 'failed') summary.failedShards.push(part.shard);
    if (outcome !== 'failed' && (outcome === 'incomplete' || part.outcome === 'incomplete')) summary.incompleteShards.push(part.shard);
  }
  for (let shard = 0; shard < shardCount; shard++) if (!seen.has(shard)) summary.missingShards.push(shard);
  summary.workers.sort((left, right) => left.shard - right.shard);
  summary.capacity = summarizeRewriteCapacity(parts.flatMap(part => part.results || []), {
    startedAt: summary.startedAt, finishedAt: summary.finishedAt, attempted: summary.attempted,
  });
  const intervals = parts.map(part => [Date.parse(part.startedAt), Date.parse(part.finishedAt)])
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start);
  const runnerSeconds = intervals.reduce((total, [start, end]) => total + (end - start) / 1000, 0);
  const events = intervals.flatMap(([start, end]) => [[start, 1], [end, -1]])
    .sort((left, right) => left[0] - right[0] || left[1] - right[1]);
  let active = 0, peak = 0;
  for (const [, change] of events) { active += change; peak = Math.max(peak, active); }
  const timingComplete = !summary.missingShards.length && intervals.length === parts.length && intervals.length > 0;
  Object.assign(summary.capacity, { runnerTimingSamples: intervals.length, runnerTimingBasis: 'rewrite_process',
    runnerHours: timingComplete ? runnerSeconds / 3600 : null,
    peakActiveRunners: timingComplete ? peak : null,
    averageActiveRunners: timingComplete && summary.capacity.elapsedSeconds ? runnerSeconds / summary.capacity.elapsedSeconds : null,
    publishedPerRunnerHour: timingComplete && runnerSeconds ? summary.published / runnerSeconds * 3600 : null });
  if (summary.cancelled) Object.assign(summary, { reason: 'interrupted', stopReason: 'cancelled' });
  else if (summary.budgetExhausted || parts.some(part => part.stopReason === 'budget_exhausted' || part.reason === 'workflow_budget_exhausted')) {
    Object.assign(summary, { reason: 'workflow_budget_exhausted', stopReason: 'budget_exhausted', budgetExhausted: true });
  } else if (summary.qualityStopped) Object.assign(summary, { reason: 'model_quality_unavailable', stopReason: 'readiness_rejected' });
  return summary;
}
