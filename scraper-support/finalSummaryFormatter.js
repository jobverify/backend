import { isCompleteScraperAttempt } from './utils/inventoryEvidence.js'
import { isUnavailableZeroOutcome } from './utils/scraperOutcome.js'
import { summarizeScraperRun } from './utils/scraperRunSummary.js'

const RANKED_SOURCE_LIMIT = 5
const FAILURE_EXAMPLE_LIMIT = 3

const formatStatus = (result = {}) => {
  if (result.skipped) return 'Skip'
  if (result.failureKind === 'coverage_gap' || isUnavailableZeroOutcome(result.zeroJobEvidence)) return 'Coverage'
  if (result.success) return isCompleteScraperAttempt(result) ? 'OK' : 'Partial'
  return result.softFailure ? 'Upstream' : 'Warn'
}

const toFiniteNonNegative = (value) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0
}

const median = (values) => percentile(values, 50)

const percentile = (values, percentileValue) => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const rank = Math.max(1, Math.ceil((percentileValue / 100) * sorted.length))
  return sorted[rank - 1]
}

const formatSeconds = (milliseconds) => `${(milliseconds / 1000).toFixed(1)}s`

const formatDuration = (milliseconds) => {
  const tenthsOfSeconds = Math.round(milliseconds / 100)
  const hours = Math.floor(tenthsOfSeconds / 36_000)
  const minutes = Math.floor((tenthsOfSeconds % 36_000) / 600)
  const seconds = ((tenthsOfSeconds % 600) / 10).toFixed(1)
  const parts = []

  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  parts.push(`${seconds}s`)

  return parts.join(' ')
}

const formatPercent = (numerator, denominator) => (
  `${(denominator > 0 ? (numerator / denominator) * 100 : 0).toFixed(1)}%`
)

const toValidDate = (value) => {
  if (value == null) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const formatIstTimestamp = (value) => {
  const date = toValidDate(value)
  if (!date) return 'unavailable'

  const istDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000))
  return `${istDate.toISOString().slice(0, 19).replace('T', ' ')} IST`
}

const formatAsciiTable = (headers, rows) => {
  const normalizedRows = rows.map((row) => row.map((value) => String(value)))
  const widths = headers.map((header, index) => Math.max(
    header.length,
    ...normalizedRows.map((row) => (row[index] || '').length),
  ))
  const border = `+${widths.map((width) => '-'.repeat(width + 2)).join('+')}+`
  const formatRow = (row) => `| ${row.map((value, index) => String(value).padEnd(widths[index])).join(' | ')} |`

  return [border, formatRow(headers), border, ...normalizedRows.map(formatRow), border].join('\n')
}

const isTimedOut = (result = {}) => /timed?\s*out|timeout|aborted due to timeout/i.test(String(result.error || ''))

const classifyFailureGroup = (result = {}) => {
  const error = String(result.error || result.failureKind || '')
  if (isTimedOut(result)) return 'Timeout'
  if (/http[\s_:-]*429\b|rate.limit|too many requests/i.test(error)) return 'Rate limit'
  if (/challenge|captcha|human verification|verify (?:you are )?human/i.test(error)) return 'Access challenge'
  if (/\bHTTP[\s_:-]*4\d\d\b/i.test(error)) return 'HTTP 4xx'
  if (/\bHTTP[\s_:-]*5\d\d\b/i.test(error)) return 'HTTP 5xx'
  if (/certificate|TLS|SSL|UNABLE_TO_VERIFY_LEAF_SIGNATURE/i.test(error)) return 'TLS/certificate'
  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|EAI_AGAIN|queryA|fetch failed|network/i.test(error)) return 'DNS/network'
  if (/no longer matches|changed materially|no longer exposes|expected .* shape|verified .* page/i.test(error)) return 'Page contract drift'
  return 'Other'
}

const sortByMetricThenSource = (rows, metric) => [...rows].sort((left, right) => (
  metric(right) - metric(left) || left.source.localeCompare(right.source)
))

const groupFailures = (attention) => {
  const groups = new Map()
  for (const row of attention) {
    const category = classifyFailureGroup(row.result)
    const group = groups.get(category) || { category, sources: [] }
    group.sources.push(row.source)
    groups.set(category, group)
  }

  return [...groups.values()]
    .sort((left, right) => right.sources.length - left.sources.length || left.category.localeCompare(right.category))
    .map(({ category, sources }) => [
      category,
      sources.length,
      sources.slice(0, FAILURE_EXAMPLE_LIMIT).join(', '),
    ])
}

export const formatFinalSummaryTable = (summary = {}, { previousRun = null, runTiming = null } = {}) => {
  const rows = Object.entries(summary).map(([source, result = {}]) => ({ source, result }))
  const processed = rows.length
  const counts = rows.reduce((total, { result }) => {
    total[formatStatus(result)] += 1
    return total
  }, { OK: 0, Partial: 0, Skip: 0, Coverage: 0, Upstream: 0, Warn: 0 })
  const runSummary = summarizeScraperRun(rows.map(({ result }) => result))
  const succeeded = runSummary.taskOutcomes.succeeded
  const totalJobs = rows.reduce((total, { result }) => total + toFiniteNonNegative(result.jobs), 0)
  const jobsPerSource = rows.map(({ result }) => toFiniteNonNegative(result.jobs))
  const sourcesWithJobs = rows.filter(({ result }) => toFiniteNonNegative(result.jobs) > 0).length
  const zeroJobRows = rows.filter(({ result }) => (
    toFiniteNonNegative(result.jobs) === 0
    && !result.skipped && (result.success === true || Boolean(result.zeroJobEvidence))
  ))
  const zeroJobEvidenceCount = (evidence) => zeroJobRows.filter(({ result }) => (
    (result.zeroJobEvidence || 'unverified-zero') === evidence
  )).length
  const verifiedEmptySources = zeroJobEvidenceCount('verified-empty')
  const fetchedZeroSources = zeroJobEvidenceCount('fetched-zero')
  const blockedZeroSources = zeroJobEvidenceCount('blocked-zero')
  const coverageGapSources = zeroJobEvidenceCount('coverage-gap')
  const unverifiedZeroSources = zeroJobRows.length
    - verifiedEmptySources
    - fetchedZeroSources
    - blockedZeroSources
    - coverageGapSources
  const totalNew = rows.reduce((total, { result }) => total + toFiniteNonNegative(result.inserted), 0)
  const totalUpdated = rows.reduce((total, { result }) => total + toFiniteNonNegative(result.updated), 0)
  const durations = rows.map(({ result }) => toFiniteNonNegative(result.durationMs))
  const cumulativeDuration = durations.reduce((total, value) => total + value, 0)
  const slowest = sortByMetricThenSource(rows, ({ result }) => toFiniteNonNegative(result.durationMs))[0]
  const attention = rows.filter(({ result }) => ['Upstream', 'Warn'].includes(formatStatus(result)))
  const timedOutSources = attention.filter(({ result }) => isTimedOut(result)).length
  const dataQuality = rows.reduce((total, { result }) => ({
    missingTitle: total.missingTitle + toFiniteNonNegative(result.dataQuality?.missingTitle),
    missingLocation: total.missingLocation + toFiniteNonNegative(result.dataQuality?.missingLocation),
    missingApplyUrl: total.missingApplyUrl + toFiniteNonNegative(result.dataQuality?.missingApplyUrl),
  }), { missingTitle: 0, missingLocation: 0, missingApplyUrl: 0 })
  const publishableFilters = rows.reduce((total, { result }) => ({
    eligibleJobs: total.eligibleJobs + toFiniteNonNegative(result.eligibleJobs),
    filteredNonIndia: total.filteredNonIndia + toFiniteNonNegative(result.filteredNonIndia),
    filteredClosed: total.filteredClosed + toFiniteNonNegative(result.filteredClosed),
    filteredInvalidUrl: total.filteredInvalidUrl + toFiniteNonNegative(result.filteredInvalidUrl),
  }), {
    eligibleJobs: 0,
    filteredNonIndia: 0,
    filteredClosed: 0,
    filteredInvalidUrl: 0,
  })
  const retriedRows = rows.filter(({ result }) => Number(result.retry?.retries) > 0)
  const totalAttempts = rows.reduce((total, { result }) => total + Number(result.retry?.attemptsUsed || 1), 0)
  const retryDelayMs = rows.reduce((total, { result }) => total + toFiniteNonNegative(result.retry?.retryDelayMs), 0)
  const pressureRows = rows.filter(({ result }) => result.retryPressure)
  const pressureTotal = metric => pressureRows.length
    ? pressureRows.reduce((total, { result }) => total + toFiniteNonNegative(metric(result.retryPressure)), 0)
    : null
  const nestedRetries = pressureTotal(pressure => pressure.nestedRetries)
  const nestedRetryDelayMs = pressureTotal(pressure => pressure.nestedRetryDelayMs)
  const rateLimitResponses = pressureTotal(pressure => pressure.httpStatusCounts?.[429])
  const workdayQueueWaitMs = pressureTotal(pressure => pressure.sourceAdmission?.queueWaitMs)
  const workdayQueuedSources = pressureRows.length
    ? pressureRows.filter(({ result }) => result.retryPressure.sourceAdmission?.queuedAttempts > 0).length
    : null
  const startedAt = toValidDate(runTiming?.startedAt)
  const completedAt = toValidDate(runTiming?.completedAt)
  const elapsedMs = startedAt && completedAt
    ? Math.max(0, completedAt.getTime() - startedAt.getTime())
    : null
  const previousSources = previousRun?.sources || null
  const previousEntries = previousSources ? Object.entries(previousSources) : []
  const previousJobs = previousRun?.overall?.totalJobs ?? null
  const previousSucceeded = previousRun?.overall?.sourcesSucceeded ?? null
  const previousZeroJobSources = previousSources
    ? new Set(previousEntries.filter(([, result]) => Number(result.jobsFound || 0) === 0).map(([source]) => source))
    : null
  const zeroNowSources = zeroJobRows.map(({ source }) => source)
  const knownEmpty = previousZeroJobSources ? zeroNowSources.filter((source) => previousZeroJobSources.has(source)) : null
  const needsReview = previousSources ? zeroNowSources.filter((source) => !previousZeroJobSources.has(source)) : null
  const delta = (current, previous) => previous == null ? 'unavailable' : `${current - previous >= 0 ? '+' : ''}${current - previous}`
  const sourceChanges = previousSources
    ? rows.map(({ source, result }) => {
      const previous = Number(previousSources[source]?.jobsFound || 0)
      const current = toFiniteNonNegative(result.jobs)
      return { source, previous, current, change: current - previous }
    }).filter(({ change }) => change !== 0)
      .sort((left, right) => Math.abs(right.change) - Math.abs(left.change) || left.source.localeCompare(right.source))
      .slice(0, RANKED_SOURCE_LIMIT)
    : null
  const topJobSources = sortByMetricThenSource(
    rows.filter(({ result }) => toFiniteNonNegative(result.jobs) > 0),
    ({ result }) => toFiniteNonNegative(result.jobs),
  ).slice(0, RANKED_SOURCE_LIMIT)
  const topSlowestSources = sortByMetricThenSource(
    rows,
    ({ result }) => toFiniteNonNegative(result.durationMs),
  ).slice(0, RANKED_SOURCE_LIMIT)
  const topJobShare = topJobSources.reduce(
    (total, { result }) => total + toFiniteNonNegative(result.jobs),
    0,
  )

  const sections = [
    'Analytical Pipeline Summary',
    'RUN TIMING',
    formatAsciiTable(['Metric', 'Value'], [
      ['Start time', formatIstTimestamp(startedAt)],
      ['End time', formatIstTimestamp(completedAt)],
      ['Total time taken', elapsedMs == null ? 'unavailable' : formatDuration(elapsedMs)],
      ['Cumulative worker time', formatDuration(cumulativeDuration)],
    ]),
    'RUN HEALTH',
    formatAsciiTable(['Metric', 'Value'], [
      ['Sources processed', processed],
      ['Tasks succeeded', succeeded],
      ['Extraction health', runSummary.health],
      ['Failed tasks (soft + hard)', runSummary.failedTasks],
      ['Soft failures', runSummary.taskOutcomes.softFailed],
      ['Hard failures', runSummary.taskOutcomes.hardFailed],
      ['Skipped', counts.Skip],
      ['Coverage gaps', counts.Coverage],
      ['Upstream issues', counts.Upstream],
      ['Source warnings', counts.Warn],
      ['Task success rate', formatPercent(succeeded, processed)],
      ['Complete inventory evidence', runSummary.inventoryChecks.complete],
      ['Complete extractions', runSummary.extractionChecks.complete],
      ['Incomplete extractions', runSummary.extractionChecks.incomplete],
      ['Partial successful tasks', counts.Partial],
      ['Complete-extraction rate', formatPercent(runSummary.extractionChecks.complete, processed)],
      ['Zero India-job results', zeroJobRows.length],
    ]),
    'JOB YIELD',
    formatAsciiTable(['Metric', 'Value'], [
      ['India jobs returned', totalJobs],
      ['Unique India jobs', runSummary.jobYield.uniqueJobs ?? 'unavailable'],
      ['Duplicate observations', runSummary.jobYield.duplicateObservations ?? 'unavailable'],
      ['Sources missing identity evidence', runSummary.jobYield.sourcesWithoutIdentityEvidence],
      ['Sources with jobs', sourcesWithJobs],
      ['Job-yield rate', formatPercent(sourcesWithJobs, processed)],
      ['Average jobs/source', processed > 0 ? (totalJobs / processed).toFixed(1) : '0.0'],
      ['Median jobs/source', median(jobsPerSource).toFixed(1)],
      ['Top-5 source share', formatPercent(topJobShare, totalJobs)],
      ['New jobs', totalNew],
      ['Updated jobs', totalUpdated],
    ]),
    'PUBLISHABLE FILTERS',
    formatAsciiTable(['Metric', 'Value'], [
      ['Publishable jobs', publishableFilters.eligibleJobs],
      ['Publishable rate', formatPercent(publishableFilters.eligibleJobs, totalJobs)],
      ['Rejected outside India', publishableFilters.filteredNonIndia],
      ['Rejected past closing date', publishableFilters.filteredClosed],
      ['Rejected invalid URL', publishableFilters.filteredInvalidUrl],
    ]),
    'PERFORMANCE',
    formatAsciiTable(['Metric', 'Value'], [
      ['Parallelism factor', elapsedMs && elapsedMs > 0 ? `${(cumulativeDuration / elapsedMs).toFixed(1)}x` : 'unavailable'],
      ['Median source runtime', formatSeconds(median(durations))],
      ['P95 source runtime', formatSeconds(percentile(durations, 95))],
      ['Slowest source', slowest ? `${slowest.source} (${formatSeconds(toFiniteNonNegative(slowest.result.durationMs))})` : 'none'],
      ['Timed-out sources', timedOutSources],
    ]),
    'DATA QUALITY',
    formatAsciiTable(['Metric', 'Value'], [
      ['Missing title', dataQuality.missingTitle],
      ['Missing-title rate', formatPercent(dataQuality.missingTitle, totalJobs)],
      ['Missing location', dataQuality.missingLocation],
      ['Missing-location rate', formatPercent(dataQuality.missingLocation, totalJobs)],
      ['Missing application URL', dataQuality.missingApplyUrl],
      ['Missing-application-URL rate', formatPercent(dataQuality.missingApplyUrl, totalJobs)],
    ]),
    'RETRY AND TIMEOUT PRESSURE',
    formatAsciiTable(['Metric', 'Value'], [
      ['Sources retried', retriedRows.length],
      ['Total retry attempts', Math.max(0, totalAttempts - processed)],
      ['Retry recovery rate', formatPercent(retriedRows.filter(({ result }) => result.success).length, retriedRows.length)],
      ['Timed-out sources', timedOutSources],
      ['Time spent retrying', formatSeconds(retryDelayMs)],
      ['Nested telemetry sources', `${pressureRows.length}/${processed}`],
      ['Nested retry attempts', nestedRetries ?? 'unavailable'],
      ['Nested retry backoff', nestedRetryDelayMs === null ? 'unavailable' : formatSeconds(nestedRetryDelayMs)],
      ['Shared HTTP 429 responses', rateLimitResponses ?? 'unavailable'],
      ['Workday queued sources', workdayQueuedSources ?? 'unavailable'],
      ['Workday source queue time', workdayQueueWaitMs === null ? 'unavailable' : formatSeconds(workdayQueueWaitMs)],
    ]),
    'ZERO-YIELD WATCHLIST',
    formatAsciiTable(['Metric', 'Value'], [
      ['Zero India-job results', zeroNowSources.length],
      ['Verified empty career surfaces', verifiedEmptySources],
      ['Fetched zero India-job results', fetchedZeroSources],
      ['Blocked or failed zero results', blockedZeroSources],
      ['Unverified zero results', unverifiedZeroSources],
      ['Coverage-gap zero results', coverageGapSources],
      ['Previously zero India-job results', knownEmpty == null ? 'unavailable' : knownEmpty.length],
      ['New zero India-job results', needsReview == null ? 'unavailable' : needsReview.length],
      ['Prior-non-empty examples', needsReview == null ? 'unavailable' : (needsReview.slice(0, 5).join(', ') || 'none')],
    ]),
    'RUN-OVER-RUN CHANGE',
    formatAsciiTable(['Metric', 'Current', 'Previous', 'Change'], [
      ['India jobs', totalJobs, previousJobs ?? 'unavailable', delta(totalJobs, previousJobs)],
      ['Successful tasks', succeeded, previousSucceeded ?? 'unavailable', delta(succeeded, previousSucceeded)],
      ['Timed-out sources', timedOutSources, 'unavailable', 'unavailable'],
    ]),
    'SOURCE-CHANGE ANOMALIES',
    formatAsciiTable(['Source', 'Previous', 'Current', 'Change'], sourceChanges == null
      ? [['unavailable', '-', '-', '-']]
      : (sourceChanges.length > 0
        ? sourceChanges.map(({ source, previous, current, change }) => [source, previous, current, `${change >= 0 ? '+' : ''}${change}`])
        : [['none', 0, 0, '0']])),
    'TOP JOB YIELDS',
    formatAsciiTable(['Source', 'Jobs', 'Share'], topJobSources.length > 0
      ? topJobSources.map(({ source, result }) => [
        source,
        toFiniteNonNegative(result.jobs),
        formatPercent(toFiniteNonNegative(result.jobs), totalJobs),
      ])
      : [['none', 0, '0.0%']]),
    'TOP SLOWEST SOURCES',
    formatAsciiTable(['Source', 'Duration', 'Status', 'Jobs'], topSlowestSources.length > 0
      ? topSlowestSources.map(({ source, result }) => [
        source,
        formatSeconds(toFiniteNonNegative(result.durationMs)),
        formatStatus(result),
        toFiniteNonNegative(result.jobs),
      ])
      : [['none', '0.0s', 'n/a', 0]]),
    'FAILURE GROUPS',
    formatAsciiTable(['Category', 'Sources', 'Examples'], groupFailures(attention).length > 0
      ? groupFailures(attention)
      : [['None', 0, 'none']]),
  ]

  return sections.join('\n\n')
}
