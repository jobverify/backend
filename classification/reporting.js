// Diagnostic counters only; eligibility decisions remain in the existing policy.
const resolvedTypes = ['Full-time Experienced', 'Full-time Fresher', 'Intern', 'Contract', 'Others', 'Unspecified']
const counter = keys => Object.fromEntries(keys.map(key => [key, 0]))
const increment = (counts, key, amount = 1) => {
  if (typeof key !== 'string' || !key || !Number.isFinite(amount)) return
  if (!Object.hasOwn(counts, key)) Object.defineProperty(counts, key, { value: 0, writable: true, enumerable: true, configurable: true })
  counts[key] += amount
}
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0
const bounds = [.25, .5, 1, 2, 5, 10, 30, 60, 120, 300]
const refreshInference = inference => {
  inference.meanSeconds = inference.measuredRequests ? inference.seconds / inference.measuredRequests : null
  inference.averageCpuCoresUsed = inference.cpuMeasuredSeconds ? inference.cpuSeconds / inference.cpuMeasuredSeconds : null
}

export const classificationSkipReason = (input, maxInputBytes) => !input.body ? 'missing_description'
  : Buffer.byteLength(input.body, 'utf8') > maxInputBytes ? 'oversized_description' : null

export const createClassificationReport = (configuration = {}) => ({
  reportingVersion: 2, modelRequests: 0,
  timingMs: {},
  resolvedCategories: counter(resolvedTypes), publicCategories: {}, modelCategories: counter(resolvedTypes.slice(0, 4)),
  descriptionOrigins: {}, skipReasons: counter(['missing_description', 'oversized_description']),
  quality: { uncertain: 0, unavailable: 0, modelAgreement: 0, modelDisagreement: 0,
    modelFinalAgreement: 0, modelFinalDisagreement: 0, modelFinalUnavailable: 0, modelFallback: 0,
    reviewRequired: 0, reviewReasons: {}, statuses: {}, sourceQualityIssues: {}, modelScoresAreCalibrated: false },
  inference: { measuredRequests: 0, seconds: 0, cpuSeconds: 0, cpuMeasuredSeconds: 0, windows: 0, maximumSeconds: 0,
    meanSeconds: null, averageCpuCoresUsed: null,
    latencyBuckets: counter([...bounds.map(value => 'le_' + value + 's'), 'over_300s']) },
  resources: { cpuThreads: configuration.cpuThreads ?? null, availableCpus: configuration.availableCpus ?? null,
    peakRssBytes: finite(configuration.peakRssBytes) ? configuration.peakRssBytes : 0 },
})

export function recordClassificationInput(summary, input) {
  increment(summary.descriptionOrigins, input.descriptionOrigin || 'unknown')
}

export function recordClassificationDecision(summary, { result, prediction, publicJobType }) {
  if (publicJobType) increment(summary.publicCategories, publicJobType)
  if (!result?.resolved) { summary.quality.unavailable++; summary.quality.modelFinalUnavailable++; return }
  increment(summary.resolvedCategories, result.resolved.jobType || 'Unspecified')
  increment(summary.quality.statuses, result.status || 'unknown')
  if (result.status === 'uncertain' || result.resolved.jobType === 'Unspecified') summary.quality.uncertain++
  for (const issue of result.sourceQualityIssues || []) increment(summary.quality.sourceQualityIssues, issue)
  if (result.comparison?.agreement === true) summary.quality.modelAgreement++
  if (result.comparison?.agreement === false) summary.quality.modelDisagreement++
  const modelLabel = prediction?.modelLabel || result.comparison?.modelJobType
  const finalLabel = result.resolved.jobType
  if (typeof modelLabel === 'string' && modelLabel && typeof finalLabel === 'string' && finalLabel) {
    summary.quality[modelLabel === finalLabel ? 'modelFinalAgreement' : 'modelFinalDisagreement']++
  } else summary.quality.modelFinalUnavailable++
  if (result.decisionSource === 'model_fallback') summary.quality.modelFallback++
  const reviewReasons = [...new Set(result.reviewReasons || [])]
  if (reviewReasons.length) summary.quality.reviewRequired++
  for (const reason of reviewReasons) increment(summary.quality.reviewReasons, reason)
  increment(summary.modelCategories, modelLabel)
}

export function recordClassificationInference(summary, prediction) {
  if (finite(prediction?.peakRssBytes)) summary.resources.peakRssBytes = Math.max(summary.resources.peakRssBytes, prediction.peakRssBytes)
  if (finite(prediction?.windows)) summary.inference.windows += prediction.windows
  if (!finite(prediction?.seconds)) return
  const values = summary.inference
  values.measuredRequests++
  values.seconds += prediction.seconds
  if (finite(prediction.cpuSeconds)) { values.cpuSeconds += prediction.cpuSeconds; values.cpuMeasuredSeconds += prediction.seconds }
  values.maximumSeconds = Math.max(values.maximumSeconds, prediction.seconds)
  const bound = bounds.find(value => prediction.seconds <= value)
  increment(values.latencyBuckets, bound === undefined ? 'over_300s' : 'le_' + bound + 's')
  refreshInference(values)
}

export function aggregateClassificationSummaries(parts) {
  const summary = { ...createClassificationReport(), assigned: 0, scanned: 0, identityScans: 0,
    completed: 0, skipped: 0, cached: 0, nativeCached: 0, failed: 0, stale: 0, leased: 0,
    budgetExhausted: false, elapsedSeconds: 0, workerSeconds: 0, workers: [], scanCountBasis: 'assigned_partitions',
    timingBasis: 'summed_operation_durations' }
  const merge = (target, source) => { for (const [key, value] of Object.entries(source || {})) if (finite(value)) increment(target, key, value) }
  for (const part of parts) {
    for (const key of ['assigned', 'completed', 'skipped', 'cached', 'nativeCached', 'failed', 'stale', 'leased', 'modelRequests']) {
      if (finite(part[key])) summary[key] += part[key]
    }
    summary.identityScans += finite(part.scanned) ? part.scanned : 0
    summary.budgetExhausted ||= part.budgetExhausted === true
    summary.elapsedSeconds = Math.max(summary.elapsedSeconds, finite(part.elapsedSeconds) ? part.elapsedSeconds : 0)
    summary.workerSeconds += finite(part.elapsedSeconds) ? part.elapsedSeconds : 0
    for (const key of ['resolvedCategories', 'publicCategories', 'modelCategories', 'descriptionOrigins', 'skipReasons']) merge(summary[key], part[key])
    merge(summary.timingMs, part.timingMs)
    for (const key of ['uncertain', 'unavailable', 'modelAgreement', 'modelDisagreement',
      'modelFinalAgreement', 'modelFinalDisagreement', 'modelFinalUnavailable', 'modelFallback', 'reviewRequired']) {
      if (finite(part.quality?.[key])) summary.quality[key] += part.quality[key]
    }
    // Old summaries cannot reconstruct final-label equality from policy agreement.
    if (!finite(part.quality?.modelFinalAgreement) && !finite(part.quality?.modelFinalDisagreement)) {
      summary.quality.modelFinalUnavailable += (finite(part.completed) ? part.completed : 0)
        + (finite(part.cached) ? part.cached : 0)
    }
    merge(summary.quality.reviewReasons, part.quality?.reviewReasons)
    merge(summary.quality.statuses, part.quality?.statuses)
    merge(summary.quality.sourceQualityIssues, part.quality?.sourceQualityIssues)
    for (const key of ['measuredRequests', 'seconds', 'cpuSeconds', 'cpuMeasuredSeconds', 'windows']) {
      if (finite(part.inference?.[key])) summary.inference[key] += part.inference[key]
    }
    summary.inference.maximumSeconds = Math.max(summary.inference.maximumSeconds, part.inference?.maximumSeconds || 0)
    merge(summary.inference.latencyBuckets, part.inference?.latencyBuckets)
    // Each shard runs on a separate runner: retain its peak rather than sum RAM.
    summary.resources.peakRssBytes = Math.max(summary.resources.peakRssBytes, part.resources?.peakRssBytes || 0)
    summary.workers.push({ shard: part.shard, concurrency: part.concurrency ?? 1, cpuThreads: part.resources?.cpuThreads ?? null,
      availableCpus: part.resources?.availableCpus ?? null, peakRssBytes: part.resources?.peakRssBytes ?? null,
      elapsedSeconds: part.elapsedSeconds ?? null })
  }
  // Each collection identity is read by every shard. Assigned partitions count
  // jobs handled by the workers; identityScans preserves the actual scan work.
  summary.scanned = summary.assigned
  refreshInference(summary.inference)
  return summary
}
