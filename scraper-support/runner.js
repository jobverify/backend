/**
 * @file Orchestrates sequential and parallel career site scraper executions.
 * @module scraper-support/runner
 */

import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { summarizeScraperRun } from './utils/scraperRunSummary.js'
import { validateRecruitmentBatchAssets } from './utils/recruitmentBatchAssets.js'
import { jobIdentityHashes } from './utils/jobYield.js'
import { finishScraperProcessing, inventoryCleanupOptions } from './utils/scraperOutcome.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(currentDir, '../.env'), quiet: true })

import {
  purgeExpiredJobsForQuotaRecovery,
  saveDryRunSnapshot,
  saveToDB,
} from './utils/saveToDB.js'
import { getRetryMetadata, getRetryPressure, withRetry } from './utils/retry.js'
import { recordSourceAdmission } from './utils/retryPressure.js'
import { acquireWorkdaySourceAdmission } from './shared/workdaySourceAdmission.js'
import { runWithNativeDetailRecovery } from './utils/nativeDetailRecovery.js'
import { analyzePublishableJobs } from './utils/publishableJobMetrics.js'
import {
  upsertScraperStatus,
  writeScraperRun,
  readPreviousScraperRun,
  ensureScrapersSeeded,
  markPipelineRunStarted,
  markPipelineRunFinished,
} from './utils/scraperPersistence.js'
export { classifyScraperError } from './utils/failureClassification.js'
import { classifyScraperError } from './utils/failureClassification.js'
import {
  resolveParallelWorkerConcurrency,
} from './utils/parallelConcurrency.js'
import { formatFinalSummaryTable } from './finalSummaryFormatter.js'
import { installGracefulShutdownHandlers } from './utils/gracefulShutdown.js'
import { openRunCheckpoint } from './utils/runCheckpoint.js'
import { saveRawSourceCapture, saveRawSourceFailure } from './utils/rawCapture.js'
import { LocalJobOutboxPersistenceError, saveLocalJobOutbox } from './utils/localJobOutbox.js'
import { buildClassificationInput } from '../src/services/jobClassificationPolicy.js'
import {
  acquireMongoRunLease,
  DEFAULT_RUN_LEASE_WAIT_MS,
  MongoRunLeaseHeldError,
  waitForMongoRunLease,
} from './utils/runLease.js'
import { refreshJobDatasetSummary } from '../src/services/jobDatasetSummaryService.js'
import { isMongoOperationalError, retryMongoOperation } from '../src/utils/mongoOperationalError.js'
import { DEFAULT_JOB_RETENTION_DAYS } from '../src/utils/jobLifecycle.js'
import ScraperStatus from '../src/models/ScraperStatus.js'
import { buildScrapers } from './providers/index.js'
import {
  isFreshCompleteInventoryEvidence,
  isVerifiedEmptyEvidence,
  readInventoryEvidence,
} from './utils/inventoryEvidence.js'
import { extractionDetailHealth } from './utils/extractionDetailHealth.js'
import { extractionRawJobMetrics } from './utils/extractionRawJobMetrics.js'
import { readInventoryDelegationEvidence } from './utils/inventoryDelegationEvidence.js'
import { readSourceObservationEvidence } from './utils/sourceObservationEvidence.js'
import { initializeScraperProxyEnvironment } from './utils/proxyEnvironment.js'

const isDryRun = process.argv.includes('--dry-run')
const isParallel = process.argv.includes('--parallel')

export const buildScraperAttemptDiagnostics = (jobs, analysis = analyzePublishableJobs(jobs), provider = {}) => ({
  rawRecords: extractionRawJobMetrics(provider, jobs, readInventoryEvidence(jobs)).rawJobs,
  jobs: analysis.indiaJobs.length,
  jobIdentityHashes: jobIdentityHashes(analysis.indiaJobs),
  eligibleJobs: analysis.eligibleJobs.length,
  filteredNonIndia: analysis.filterCounts.nonIndia,
  filteredOld: analysis.filterCounts.old,
  filteredClosed: analysis.filterCounts.closed,
  filteredInvalidUrl: analysis.filterCounts.invalidUrl,
  filteredEmptyDescription: analysis.filterCounts.emptyDescription,
  filteredNonJob: analysis.filterCounts.nonJob,
  inventoryEvidence: readInventoryEvidence(jobs),
  detailHealth: extractionDetailHealth(analysis.indiaJobs),
  ...(readInventoryDelegationEvidence(jobs)
    ? { inventoryDelegationEvidence: readInventoryDelegationEvidence(jobs) } : {}),
  ...(readSourceObservationEvidence(jobs, provider.source)
    ? { sourceObservations: readSourceObservationEvidence(jobs, provider.source) } : {}),
})
const resolveExecutionPath = (value) => {
  if (value == null || value === '') return null

  const absolutePath = path.resolve(String(value))
  try {
    return fs.realpathSync.native(absolutePath)
  } catch {
    return absolutePath
  }
}
const DEFAULT_SCRAPER_TIMEOUT_MS = 5 * 60 * 1000
const DEFAULT_WORKDAY_SCRAPER_TIMEOUT_MS = 210 * 1000
const DEFAULT_SOURCE_LIFECYCLE_TIMEOUT_MS = 30 * 60 * 1000
const DEFAULT_ABORT_GRACE_MS = 15 * 1000
const DRY_RUN_EXPERIENCE_ENRICHMENT_CONCURRENCY = 2
const DEFAULT_DRY_RUN_MAX_JOBS_TO_ENRICH = null

export const isDryRunPublicExperienceEnabled = (
  value = process.env.SCRAPER_DISABLE_DRY_RUN_PUBLIC_EXPERIENCE,
) => !/^(?:1|true|yes)$/i.test(String(value ?? '').trim())

export const resolveDryRunPublicExperienceEnabled = ({
  scraper = null,
  value = process.env.SCRAPER_DISABLE_DRY_RUN_PUBLIC_EXPERIENCE,
} = {}) => {
  if (scraper?.provider?.dryRunEnrichPublicExperience === true) return true
  if (scraper?.provider?.dryRunEnrichPublicExperience === false) return false
  return isDryRunPublicExperienceEnabled(value)
}

export const resolveDryRunMaxJobsToEnrich = (
  value = process.env.SCRAPER_DRY_RUN_MAX_JOBS_TO_ENRICH,
) => {
  const normalized = String(value ?? '').trim()
  if (!normalized) return DEFAULT_DRY_RUN_MAX_JOBS_TO_ENRICH
  if (/^(?:all|full|unlimited)$/i.test(normalized)) return null

  const parsed = Number.parseInt(normalized, 10)
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed
  }

  return DEFAULT_DRY_RUN_MAX_JOBS_TO_ENRICH
}

export const buildDryRunSnapshotOptions = ({
  scraper = null,
  signal = null,
  onStage = null,
  capturedAt = null,
  captureFile = null,
  localJobOutboxDirectory = isDryRun ? process.env.SCRAPER_LOCAL_JOB_OUTBOX_DIRECTORY : null,
  enrichPublicExperience = resolveDryRunPublicExperienceEnabled({ scraper }),
  experienceEnrichmentConcurrency = String(localJobOutboxDirectory || '').trim() ? 1 : DRY_RUN_EXPERIENCE_ENRICHMENT_CONCURRENCY,
  maxJobsToEnrich = resolveDryRunMaxJobsToEnrich(
    scraper?.provider?.dryRunMaxJobsToEnrich ?? process.env.SCRAPER_DRY_RUN_MAX_JOBS_TO_ENRICH,
  ),
} = {}) => ({
  enrichPublicExperience,
  experienceEnrichmentConcurrency,
  maxJobsToEnrich,
  ...(signal ? { signal } : {}),
  ...(scraper?.name ? { source: scraper.name } : {}),
  ...(onStage ? { onStage } : {}),
  ...(String(localJobOutboxDirectory || '').trim() ? { localJobOutboxDirectory, capturedAt, captureFile } : {}),
})

const queueProviderDescriptions = async (jobs, scraper, { capturedAt, captureFile } = {}) => {
  if (!isDryRun || !String(process.env.SCRAPER_LOCAL_JOB_OUTBOX_DIRECTORY || '').trim()) return null
  const describedJobs = jobs.filter(job => !buildClassificationInput(job).incomplete)
  if (!describedJobs.length) return null
  return saveLocalJobOutbox(describedJobs, {
    source: scraper.name, dryRun: true, capturedAt, captureFile, phase: 'raw_provider_description',
  })
}

export const finalizeDirectRunnerExit = ({
  processRef = process,
  exit = null,
} = {}) => {
  const exitCode = Number.isInteger(processRef?.exitCode) ? processRef.exitCode : 0
  if (processRef && !Number.isInteger(processRef.exitCode)) {
    processRef.exitCode = exitCode
  }
  const exitFn = typeof exit === 'function' ? exit : processRef?.exit
  if (typeof exitFn === 'function') {
    exitFn(exitCode)
  }
  return exitCode
}

export const formatIstTimestamp = (timestamp = new Date()) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(timestamp)
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, value]),
  )
  const milliseconds = String(timestamp.getUTCMilliseconds()).padStart(3, '0')

  return `${parts.year}-${parts.month}-${parts.day} -- ${parts.hour}:${parts.minute}:${parts.second}.${milliseconds} IST`
}

export const formatParallelProgressLog = (
  completedCount,
  totalScrapers,
  timestamp = new Date(),
) => `[${formatIstTimestamp(timestamp)}] [runner] Progress: ${completedCount}/${totalScrapers} scrapers finished.`

export class ScraperSourceTimeoutError extends Error {
  constructor(scraperName, timeoutMs) {
    super(`[${scraperName}] timed out after ${timeoutMs}ms`)
    this.name = 'ScraperSourceTimeoutError'
    this.localTimeout = true
    this.abortRetries = true
    this.failureKind = 'runner_timeout'
  }
}

export class ScraperSourceLifecycleTimeoutError extends Error {
  constructor(scraperName, timeoutMs) {
    super(`[${scraperName}] lifecycle timed out after ${timeoutMs}ms`)
    this.name = 'ScraperSourceLifecycleTimeoutError'
    this.localTimeout = true
    this.abortRetries = true
    this.failureKind = 'runner_lifecycle_timeout'
  }
}

const hasPuppeteerInternals = (value = '') => (
  /puppeteer|CdpCDPSession|CallbackRegistry|NodeWebSocketTransport|puppeteer-core[\\/].*common[\\/]util\.js|third_party[\\/]rxjs/i.test(value)
)

const MONGODB_STORAGE_QUOTA_PATTERNS = [
  /over your space quota/i,
  /writes are blocked on your cluster/i,
]

const collectNestedErrorText = (reason) => {
  const queue = [reason]
  const seen = new Set()
  const fragments = []

  while (queue.length > 0) {
    const current = queue.shift()
    if (current == null) continue

    const isTrackable = typeof current === 'object' || typeof current === 'function'
    if (isTrackable) {
      if (seen.has(current)) continue
      seen.add(current)
    }

    if (typeof current === 'string') {
      fragments.push(current)
      continue
    }

    for (const value of [current?.name, current?.message, current?.stack]) {
      if (value) fragments.push(String(value))
    }

    if (current?.cause) queue.push(current.cause)
    if (Array.isArray(current?.errors)) queue.push(...current.errors)
  }

  return fragments.join('\n')
}

export const isMongoStorageQuotaWriteBlockError = (error) => {
  const errorText = collectNestedErrorText(error)
  return MONGODB_STORAGE_QUOTA_PATTERNS.every((pattern) => pattern.test(errorText))
}

export class FatalScraperPersistenceError extends Error {
  constructor(message, options = {}) {
    super(message, options)
    this.name = 'FatalScraperPersistenceError'
    this.persistenceBlocked = true
    this.abortPipeline = true
  }
}

const toFatalScraperPersistenceError = (context, error, { required = false } = {}) => {
  if (isMongoOperationalError(error)) return null
  if (!required && !isMongoStorageQuotaWriteBlockError(error)) return null

  return new FatalScraperPersistenceError(
    `${context}: ${error?.message || String(error)}`,
    error ? { cause: error } : undefined,
  )
}

const pendingPersistenceResult = (error, result = {}) => ({
  ...result,
  success: false,
  softFailure: true,
  upstreamOutage: false,
  failureKind: 'database_unavailable',
  persistencePending: true,
  processingComplete: false,
  error: error?.message || String(error),
})

const hasPendingPersistence = result => result?.persistencePending || result?.classificationPending
const deferRunPersistence = summary => Object.defineProperty(summary, 'persistencePending', { value: true, configurable: true })

const isProgrammingError = error => {
  const seen = new Set()
  for (let current = error; current && !seen.has(current); current = current.cause) {
    seen.add(current)
    if (current instanceof TypeError || current instanceof ReferenceError || current instanceof SyntaxError || current instanceof RangeError) return true
  }
  return false
}

const writePipelineSummary = summary => {
  if (!process.env.PIPELINE_SUMMARY_FILE) return
  fs.mkdirSync(path.dirname(process.env.PIPELINE_SUMMARY_FILE), { recursive: true })
  fs.writeFileSync(process.env.PIPELINE_SUMMARY_FILE, JSON.stringify(summary))
}

export const isLatePuppeteerTargetClose = (reason) => {
  const reasonText = collectNestedErrorText(reason)

  return /TargetCloseError|Protocol error .*(?:Target|Session) closed|(?:Target|Session) closed/i.test(reasonText)
    && hasPuppeteerInternals(reasonText)
}

export const isLatePuppeteerWaitTimeout = (reason) => {
  const reasonText = collectNestedErrorText(reason)

  return /(?:^|\n)TimeoutError(?::|\n|$)/i.test(reasonText)
    && /Timed out after waiting \d+ms/i.test(reasonText)
    && hasPuppeteerInternals(reasonText)
}

export const shouldIgnoreUnhandledRejection = (reason) => (
  isLatePuppeteerTargetClose(reason)
  || isLatePuppeteerWaitTimeout(reason)
  || classifyScraperError(reason).softFailure === true
)

process.on('unhandledRejection', (reason) => {
  if (isLatePuppeteerTargetClose(reason)) {
    console.error('[runner] Ignored late Puppeteer browser-close rejection:', reason.message || reason)
    return
  }

  if (isLatePuppeteerWaitTimeout(reason)) {
    console.error('[runner] Ignored late Puppeteer wait-timeout rejection:', reason.message || reason)
    return
  }

  const classification = classifyScraperError(reason)
  if (classification.softFailure === true) {
    console.error(
      `[runner] Ignored late scraper soft-failure rejection (${classification.failureKind}):`,
      reason?.message || reason,
    )
    return
  }

  throw reason
})

const normalizeRequestedSource = (value) => String(value || '').trim().toLowerCase()

const buildScraperSourceLookup = (scrapers = []) => {
  const bySource = new Map()

  for (const scraper of scrapers) {
    const source = normalizeRequestedSource(scraper.name)
    bySource.set(source, scraper)
  }

  return bySource
}

const resolveRequestedScraper = (source, lookup) => {
  const normalizedSource = normalizeRequestedSource(source)
  const exact = lookup.get(normalizedSource)
  if (exact) return { scraper: exact }

  return { missing: true }
}

export const selectScrapersForRun = (
  scrapers,
  {
    onlySources = process.env.SCRAPER_ONLY,
    startAt = process.env.SCRAPER_START_AT,
    startAfter = process.env.SCRAPER_START_AFTER,
    firstN = process.env.SCRAPER_FIRST_N,
    dryRun = isDryRun,
  } = {},
) => {
  const requestedSources = String(onlySources || '')
    .split(',')
    .map((source) => normalizeRequestedSource(source))
    .filter(Boolean)
  const normalizedStartAt = normalizeRequestedSource(startAt)
  const normalizedStartAfter = normalizeRequestedSource(startAfter)
  const normalizedFirstN = String(firstN ?? '').trim()

  if (normalizedFirstN) {
    if (!/^[1-9]\d*$/.test(normalizedFirstN) || !Number.isSafeInteger(Number(normalizedFirstN))) {
      throw new Error('SCRAPER_FIRST_N must be a strict positive integer.')
    }
    if (requestedSources.length || normalizedStartAt || normalizedStartAfter) {
      throw new Error('Use SCRAPER_FIRST_N by itself, without SCRAPER_ONLY, SCRAPER_START_AT, or SCRAPER_START_AFTER.')
    }
    if (!dryRun) throw new Error('SCRAPER_FIRST_N requires --dry-run.')
    const selected = scrapers.slice(0, Number(normalizedFirstN))
    return {
      scrapers: selected,
      resumeMessage: `Running the first ${selected.length}/${scrapers.length} scrapers in catalog order.`,
    }
  }

  if (requestedSources.length && (normalizedStartAt || normalizedStartAfter)) {
    throw new Error('Use SCRAPER_ONLY by itself, without SCRAPER_START_AT or SCRAPER_START_AFTER.')
  }

  if (normalizedStartAt && normalizedStartAfter) {
    throw new Error('Use only one of SCRAPER_START_AT or SCRAPER_START_AFTER.')
  }

  const lookup = buildScraperSourceLookup(scrapers)

  if (requestedSources.length) {
    const selected = []
    const missing = []
    const seen = new Set()
    const resolvedSources = new Set()

    for (const source of requestedSources) {
      if (seen.has(source)) continue
      seen.add(source)

      const resolution = resolveRequestedScraper(source, lookup)
      if (resolution.missing) {
        missing.push(source)
        continue
      }

      const scraper = resolution.scraper
      const resolvedSource = normalizeRequestedSource(scraper.name)
      if (resolvedSources.has(resolvedSource)) continue
      resolvedSources.add(resolvedSource)
      selected.push(scraper)
    }

    if (missing.length) {
      throw new Error(`SCRAPER_ONLY source(s) not found in the scraper catalog: ${missing.join(', ')}.`)
    }

    return {
      scrapers: selected,
      resumeMessage: `Running selected sources (${selected.length}/${scrapers.length} scrapers selected): ${selected.map((scraper) => scraper.name).join(', ')}.`,
    }
  }

  const resumeSource = normalizedStartAt || normalizedStartAfter
  if (!resumeSource) {
    return { scrapers, resumeMessage: null }
  }

  const resumeResolution = resolveRequestedScraper(resumeSource, lookup)
  if (resumeResolution.missing) {
    throw new Error(`Resume source "${resumeSource}" was not found in the scraper catalog.`)
  }

  const sourceIndex = scrapers.findIndex((scraper) => (
    normalizeRequestedSource(scraper.name) === normalizeRequestedSource(resumeResolution.scraper.name)
  ))
  const startIndex = normalizedStartAfter ? sourceIndex + 1 : sourceIndex
  const selected = scrapers.slice(startIndex)
  return {
    scrapers: selected,
    resumeMessage: `Resuming at ${selected[0]?.name || 'end of catalog'} (${selected.length}/${scrapers.length} scrapers selected).`,
  }
}

export const shouldClearExistingJobsBeforeRun = ({
  onlySources = process.env.SCRAPER_ONLY,
  startAt = process.env.SCRAPER_START_AT,
  startAfter = process.env.SCRAPER_START_AFTER,
  firstN = process.env.SCRAPER_FIRST_N,
} = {}) => !String(onlySources || '').trim()
  && !String(startAt || '').trim()
  && !String(startAfter || '').trim()
  && !String(firstN || '').trim()

// Keep bounded local trials away from the canonical scraper snapshots.
export const isolateDryRunSnapshots = (scrapers, {
  dryRun = isDryRun,
  directory = process.env.SCRAPER_DRY_RUN_OUTPUT_DIRECTORY,
} = {}) => {
  if (!dryRun || !String(directory || '').trim()) return scrapers
  return scrapers.map(scraper => ({
    ...scraper,
    dryRunFile: path.join(path.resolve(directory), `${scraper.name}.json`),
  }))
}

const isWorkdayScraper = (scraper) => (
  scraper?.provider?.adapter === 'workday'
  || scraper?.provider?.atsPlatform === 'workday'
)

export const isAuthoritativeEmptyScrape = (scraper, jobs) => (
  Array.isArray(jobs)
  && jobs.length === 0
  && isVerifiedEmptyEvidence(readInventoryEvidence(jobs))
  && isFreshCompleteInventoryEvidence(readInventoryEvidence(jobs))
)

export const resolveZeroJobOutcome = (scraper, jobs, indiaJobs) => {
  if (!Array.isArray(indiaJobs) || indiaJobs.length > 0) return null

  const evidence = readInventoryEvidence(jobs)
  if (isFreshCompleteInventoryEvidence(evidence)) {
    return isVerifiedEmptyEvidence(evidence) ? 'verified-empty' : 'fetched-zero'
  }
  if (evidence?.status === 'discovery-only') return 'blocked-zero'
  if (evidence?.status === 'coverage-gap') return 'coverage-gap'
  if (scraper?.provider?.zeroResultPolicy === 'coverage-gap') return 'coverage-gap'
  return 'unverified-zero'
}

export const getZeroJobEvidence = resolveZeroJobOutcome

export const buildCoverageGapResult = (_source, outcome) => ({
  success: false,
  softFailure: true,
  upstreamOutage: false,
  failureKind: 'coverage_gap',
  zeroJobEvidence: outcome,
})

export const resolveScraperRetryAttempts = (scraper) => {
  if (isWorkdayScraper(scraper)) return 1
  const configured = scraper?.provider?.scraperRetryAttempts
  return Number.isInteger(configured) && configured >= 1 && configured <= 4
    ? configured
    : 4
}

export const resolveScraperTimeoutMs = (
  value = process.env.SCRAPER_SOURCE_TIMEOUT_MS,
  scraper = null,
  workdayValue = process.env.WORKDAY_SCRAPER_TIMEOUT_MS,
) => {
  const isWorkday = isWorkdayScraper(scraper)
  const configuredSourceTimeout = Number.parseInt(
    String(scraper?.timeoutMs ?? scraper?.provider?.scraperTimeoutMs ?? '').trim(),
    10,
  )
  const parsedWorkdayTimeout = Number.parseInt(workdayValue, 10)
  const defaultTimeout = isWorkday
    ? (
        Number.isFinite(configuredSourceTimeout) && configuredSourceTimeout >= 0
          ? configuredSourceTimeout
          : (
            Number.isFinite(parsedWorkdayTimeout) && parsedWorkdayTimeout >= 0
              ? parsedWorkdayTimeout
              : DEFAULT_WORKDAY_SCRAPER_TIMEOUT_MS
          )
      )
    : (
        Number.isFinite(configuredSourceTimeout) && configuredSourceTimeout >= 0
          ? configuredSourceTimeout
          : DEFAULT_SCRAPER_TIMEOUT_MS
      )

  if (value == null || value === '') return defaultTimeout

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return defaultTimeout

  return parsed
}

export const resolveSourceLifecycleTimeoutMs = (
  value = process.env.SCRAPER_SOURCE_LIFECYCLE_TIMEOUT_MS,
  scraper = null,
) => {
  const configuredSourceTimeout = Number.parseInt(
    String(
      scraper?.sourceLifecycleTimeoutMs
      ?? scraper?.provider?.sourceLifecycleTimeoutMs
      ?? scraper?.provider?.scraperLifecycleTimeoutMs
      ?? '',
    ).trim(),
    10,
  )
  const defaultTimeout = Number.isFinite(configuredSourceTimeout) && configuredSourceTimeout >= 0
    ? configuredSourceTimeout
    : DEFAULT_SOURCE_LIFECYCLE_TIMEOUT_MS

  if (value == null || value === '') return defaultTimeout

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return defaultTimeout

  return parsed
}

export const resolveLivePublicExperienceEnabled = (
  scraper = null,
  value = process.env.SCRAPER_DISABLE_LIVE_PUBLIC_EXPERIENCE,
) => {
  if (scraper?.provider?.enrichPublicExperience === true) return true
  if (scraper?.provider?.enrichPublicExperience === false) return false
  return !/^(?:1|true|yes)$/i.test(String(value ?? '').trim())
}

const waitForAbortSettlement = async (runPromise, abortGraceMs) => {
  if (!Number.isFinite(abortGraceMs) || abortGraceMs <= 0) {
    return { settled: false }
  }

  let graceTimeoutId
  try {
    return await Promise.race([
      runPromise.then(
        (value) => ({ settled: true, value }),
        (error) => ({ settled: true, error }),
      ),
      new Promise((resolve) => {
        graceTimeoutId = setTimeout(() => resolve({ settled: false }), abortGraceMs)
      }),
    ])
  } finally {
    clearTimeout(graceTimeoutId)
  }
}

const getAbortReason = (signal, fallbackMessage) => (
  signal?.aborted ? signal.reason : new Error(fallbackMessage)
)

const throwIfAborted = (signal, fallbackMessage = 'Runner operation aborted') => {
  if (signal?.aborted) {
    throw getAbortReason(signal, fallbackMessage)
  }
}

const attachParentAbort = (parentSignal, controller, onAbort = null) => {
  if (!parentSignal) return () => {}

  const abortFromParent = () => {
    const reason = getAbortReason(parentSignal, 'Runner operation aborted')
    if (!controller.signal.aborted) {
      controller.abort(reason)
    }
    if (typeof onAbort === 'function') {
      onAbort(reason)
    }
  }

  if (parentSignal.aborted) {
    abortFromParent()
    return () => {}
  }

  parentSignal.addEventListener('abort', abortFromParent, { once: true })
  return () => parentSignal.removeEventListener('abort', abortFromParent)
}

export const withSourceLifecycleTimeout = async (
  scraper,
  operation,
  timeoutMs = resolveSourceLifecycleTimeoutMs(undefined, scraper),
  { abortGraceMs = DEFAULT_ABORT_GRACE_MS, signal = null } = {},
) => {
  if (!timeoutMs && !signal) {
    return operation({ signal: null, pauseTimeout: () => {}, resumeTimeout: () => {} })
  }

  let timeoutId
  let timeoutError = null
  const controller = new AbortController()
  let parentAbortReason = null
  let parentAborted = false
  let rejectParentAbort
  const parentAbortPromise = new Promise((_, reject) => { rejectParentAbort = reject })
  const detachParentAbort = attachParentAbort(signal, controller, (reason) => {
    parentAborted = true
    parentAbortReason = reason
    rejectParentAbort(reason)
  })
  let remainingMs = timeoutMs, timerStartedAt = 0, rejectTimeout
  const timeoutPromise = new Promise((_, reject) => { rejectTimeout = reject })
  const pauseTimeout = () => {
    if (!timeoutId) return
    clearTimeout(timeoutId)
    timeoutId = null
    remainingMs = Math.max(0, remainingMs - (Date.now() - timerStartedAt))
  }
  const resumeTimeout = () => {
    if (!timeoutMs || timeoutId || controller.signal.aborted) return
    timerStartedAt = Date.now()
    timeoutId = setTimeout(() => {
      timeoutError = new ScraperSourceLifecycleTimeoutError(scraper.name, timeoutMs)
      controller.abort(timeoutError)
      rejectTimeout(timeoutError)
    }, remainingMs)
  }
  resumeTimeout()
  const runPromise = Promise.resolve().then(() => {
    throwIfAborted(controller.signal)
    return operation({ signal: controller.signal, pauseTimeout, resumeTimeout })
  })

  try {
    return await Promise.race([
      runPromise,
      timeoutPromise,
      parentAbortPromise,
    ])
  } catch (error) {
    if ((timeoutError !== null && error === timeoutError) || (parentAborted && error === parentAbortReason)) {
      const settlement = await waitForAbortSettlement(runPromise, abortGraceMs)
      if (settlement.settled) {
        if (isPipelineFatalError(settlement.error, controller.signal)) throw settlement.error
        if (
          timeoutError !== null && error === timeoutError
          && settlement.value?.success === false
          && settlement.value?.failureKind === error.failureKind
        ) {
          return settlement.value
        }
      }
      throw error
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
    detachParentAbort()
  }
}

const runBoundedScraperPass = async (
  scraper,
  timeoutMs = resolveScraperTimeoutMs(undefined, scraper),
  { abortGraceMs = DEFAULT_ABORT_GRACE_MS, signal = null } = {},
) => {
  if (!timeoutMs && !signal) return scraper.run()

  let timeoutId
  let timeoutError = null
  let onParentAbort = null
  const controller = new AbortController()
  let parentAbortReason = null
  let parentAborted = false
  const detachParentAbort = attachParentAbort(signal, controller, (reason) => {
    parentAborted = true
    parentAbortReason = reason
  })
  const runPromise = Promise.resolve().then(() => scraper.run({ signal: controller.signal }))

  try {
    throwIfAborted(signal)
    return await Promise.race([
      runPromise,
      timeoutMs
        ? new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
              timeoutError = new ScraperSourceTimeoutError(scraper.name, timeoutMs)
              controller.abort(timeoutError)
              reject(timeoutError)
            }, timeoutMs)
          })
        : new Promise(() => {}),
      signal
        ? new Promise((_, reject) => {
            onParentAbort = () => reject(getAbortReason(signal, 'Runner operation aborted'))
            signal.addEventListener('abort', onParentAbort, { once: true })
          })
        : new Promise(() => {}),
    ])
  } catch (error) {
    if ((timeoutError !== null && error === timeoutError) || (parentAborted && error === parentAbortReason)) {
      const settlement = await waitForAbortSettlement(runPromise, abortGraceMs)
      if (isPipelineFatalError(settlement.error, controller.signal)) throw settlement.error
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
    detachParentAbort()
    if (onParentAbort) signal.removeEventListener('abort', onParentAbort)
  }
}

export const runScraperWithTimeout = async (
  scraper,
  timeoutMs = resolveScraperTimeoutMs(undefined, scraper),
  { abortGraceMs = DEFAULT_ABORT_GRACE_MS, signal = null,
    nativeDetailRecovery = /^(?:1|true|yes)$/i.test(process.env.SCRAPER_NATIVE_DETAIL_RECOVERY || ''),
    onAdmission = null, admissionTimeoutMs } = {},
) => {
  let lease = null, waiting = null
  const nativeOperations = new Set()
  const reportAdmission = event => {
    recordSourceAdmission(event)
    onAdmission?.(event)
    console.log(formatSourceStageLog({ source: scraper.name, stage: 'admission', status: event.status,
      durationMs: event.queueWaitMs, error: event.groupKey }))
  }
  try {
    lease = await acquireWorkdaySourceAdmission(scraper, { signal, admissionTimeoutMs,
      onWait: event => {
        waiting = { ...event, startedAt: Date.now() }
        reportAdmission({ ...event, status: 'waiting' })
      },
    })
    const operationSignal = lease?.signal || signal
    if (lease) reportAdmission({ status: 'admitted', groupKey: lease.groupKey, queueWaitMs: lease.queueWaitMs })
    const admittedScraper = lease ? { ...scraper, run: options => {
      const operation = Promise.resolve().then(() => {
        options?.signal?.throwIfAborted()
        return scraper.run(options)
      })
      nativeOperations.add(operation)
      operation.then(() => nativeOperations.delete(operation), () => nativeOperations.delete(operation))
      return operation
    } } : scraper
    if (!nativeDetailRecovery) return await runBoundedScraperPass(admittedScraper, timeoutMs, { abortGraceMs, signal: operationSignal })
    return await runWithNativeDetailRecovery((recovery, recoverySignal) => {
      // The attempt clock starts after admission; queue time remains bounded
      // by the source lifecycle and lease deadline and is reported separately.
      recovery.passDeadlineAt = timeoutMs > 0 ? Date.now() + Math.max(1, timeoutMs - Math.min(1000, timeoutMs / 10)) : null
      return runBoundedScraperPass({ ...admittedScraper,
        run: options => admittedScraper.run({ ...options, nativeDetailRecovery: recovery }),
      }, timeoutMs, { abortGraceMs, signal: recoverySignal })
    }, { signal: operationSignal })
  } catch (error) {
    if (!lease && waiting) reportAdmission({ status: 'cancelled', groupKey: waiting.groupKey,
      queueWaitMs: Math.max(0, Date.now() - waiting.startedAt) })
    throw error
  } finally {
    // An abort-grace expiry bounds the caller's wait, not the native operation.
    // Quarantine its shard until the actual source Promise settles. Queued
    // sources retain their own finite admission deadlines during quarantine.
    if (lease && nativeOperations.size) Promise.allSettled([...nativeOperations]).then(() => lease.release())
    else lease?.release()
  }
}

const formatPersistenceSummary = (result) => {
  const base = `${result.deleted || 0} deleted | +${result.inserted} fresh`
  const updated = result.updated ? ` | ~${result.updated} updated` : ''
  const nonIndia = result.filteredNonIndia
    ? ` | ${result.filteredNonIndia} outside India removed`
    : ''
  const closed = result.filteredClosed
    ? ` | ${result.filteredClosed} past closing date`
    : ''
  const invalidUrl = result.filteredInvalidUrl
    ? ` | ${result.filteredInvalidUrl} invalid URL filtered`
    : ''
  const emptyDescription = result.filteredEmptyDescription
    ? ` | ${result.filteredEmptyDescription} empty description filtered`
    : ''
  const lifecycle = result.missed
    ? ` | ${result.missed} lifecycle misses`
    : ''
  const expired = result.expired
    ? ` | ${result.expired} expired`
    : ''
  const staleCheck = result.staleCheckSkipped
    ? ` | stale cleanup skipped: ${result.staleCheckReason || 'previous source jobs preserved'}`
    : ''
  return `${base}${updated}${nonIndia}${closed}${invalidUrl}${emptyDescription}${lifecycle}${expired}${staleCheck}`
}

const logSourceCompletion = (scraper, result) => {
  const status = result.success !== true ? 'UNAVAILABLE' : (result.partial === true ? 'PARTIAL' : 'OK')
  const saved = result.mode === 'dry-run'
    ? `-> ${result.file}`
    : `| ${formatPersistenceSummary(result)}`
  console.log(`  ${status} [${scraper.name}] ${result.jobs} India jobs ${saved}`)
  if (result.cities?.length) console.log(`  Cities: ${result.cities.join(', ')}`)
}

const formatStageDuration = (durationMs) => (
  Number.isFinite(durationMs) ? ` in ${(durationMs / 1000).toFixed(1)}s` : ''
)

export const formatSourceStageLog = ({
  source,
  stage,
  status,
  durationMs,
  jobs,
  operations,
  processed,
  total,
  nativeComplete,
  unscanned,
  modelDecisions,
  policyDecisions,
  unresolved,
  error,
} = {}) => {
  const detailParts = []
  if (Number.isFinite(jobs)) detailParts.push(`${jobs} jobs`)
  if (Number.isFinite(operations)) detailParts.push(`${operations} ops`)
  if (Number.isFinite(processed)) detailParts.push(`${processed}/${total} processed, ${nativeComplete} complete model scans, ${unscanned} unscanned, ${modelDecisions} model labels, ${policyDecisions} policy labels, ${unresolved} unresolved`)
  if (error) detailParts.push(error)
  const details = detailParts.length ? ` (${detailParts.join(', ')})` : ''
  return `  [runner] [${source}] ${stage} ${status}${formatStageDuration(durationMs)}${details}`
}

const createSourceStageLogger = (source) => {
  let lastProgressAt = 0, lastProcessed = -1;
  return (event = {}) => {
  if (event.status === 'progress') {
    const now = Date.now();
    if (event.processed !== event.total && event.processed - lastProcessed < 25 && now - lastProgressAt < 15000) return;
    lastProgressAt = now;
    lastProcessed = event.processed;
  }
  console.log(formatSourceStageLog({
    source,
    ...event,
  }))
  }
}

const updateLiveScraperStatus = async (source, result, logStage) => {
  if (isDryRun) return

  try {
    logStage({ stage: 'status update', status: 'start' })
    await retryAfterMongoQuotaRecovery(() => upsertScraperStatus(source, result))
    logStage({ stage: 'status update', status: 'done' })
  } catch (dbErr) {
    logStage({
      stage: 'status update',
      status: 'error',
      error: dbErr?.message || String(dbErr),
    })
    if (isMongoOperationalError(dbErr)) {
      Object.assign(result, pendingPersistenceResult(dbErr, result))
      return
    }
    const fatalPersistenceError = toFatalScraperPersistenceError(
      `[pipeline] Failed to save status for [${source}]; aborting run`,
      dbErr,
      { required: true },
    )
    console.error(`  ${fatalPersistenceError.message}`)
    throw fatalPersistenceError
  }
}

export const refreshVisibleDatasetSummaryWithLogging = async ({
  refresh = refreshJobDatasetSummary,
  logStage = createSourceStageLogger('pipeline'),
} = {}) => {
  try {
    logStage({ stage: 'dataset summary', status: 'start' })
    await refresh()
    logStage({ stage: 'dataset summary', status: 'done' })
  } catch (summaryErr) {
    logStage({
      stage: 'dataset summary',
      status: 'error',
      error: summaryErr?.message || String(summaryErr),
    })
    console.error(`  [pipeline] Failed to finalize the visible dataset:`, summaryErr.message)
  }
}

// Source counts are diagnostic only; legacy SCRAPER_FAILURE_ABORT_THRESHOLD is ignored.
export const isHardSourceFailure = (result = {}) => (
  result.success === false
  && result.skipped !== true
  && result.softFailure !== true
)

const isPipelineFatalError = (error, signal = null) => {
  const seen = new Set()
  for (let current = error; current && !seen.has(current); current = current.cause) {
    // An opaque caller reason is data, including when a cleanup error wraps it.
    if (signal?.aborted && current === signal.reason) return false
    seen.add(current)
    if (current.abortPipeline === true || current.persistenceBlocked === true) return true
  }
  return false
}

const rethrowInfrastructureError = (error, { processingStarted }) => {
  if (isMongoOperationalError(error, { networkCodes: processingStarted })) return
  // Parser and job-processing failures belong to the source being attempted.
  // A source's error flags cannot escalate them into a pipeline-wide abort.
  const seen = new Set()
  for (let current = error; current && !seen.has(current); current = current.cause) {
    seen.add(current)
    if (current instanceof FatalScraperPersistenceError || current instanceof LocalJobOutboxPersistenceError) throw error
  }
}

export class MissingMongoUriError extends Error {
  constructor() {
    super(
      'MONGO_URI environment variable is required for live scraper runs. ' +
      'Set it in jobverify-backend/.env or the process environment before running the scraper pipeline.',
    )
    this.name = 'MissingMongoUriError'
    this.abortPipeline = true
  }
}

export const assertLiveMongoUriConfigured = ({
  dryRun = isDryRun,
  value = process.env.MONGO_URI,
} = {}) => {
  if (dryRun) return
  if (String(value ?? '').trim()) return
  throw new MissingMongoUriError()
}

const clearDryRunArtifact = (filePath) => {
  if (!filePath) return
  fs.rmSync(filePath, { force: true })
}

/**
 * Make one bounded expired-job purge attempt, then re-run the original write
 * once. Earlier sources remain committed because source persistence is
 * independent and idempotent.
 */
export const retryAfterMongoQuotaRecovery = async (
  operation,
  {
    purgeExpiredJobs = purgeExpiredJobsForQuotaRecovery,
    ...retryOptions
  } = {},
) => {
  return retryMongoOperation(async () => {
    try {
      return await operation()
    } catch (error) {
      if (!isMongoStorageQuotaWriteBlockError(error)) throw error

      let recovery
      try {
        recovery = await purgeExpiredJobs()
      } catch (purgeError) {
        console.error('[pipeline] Atlas quota recovery purge failed:', purgeError.message)
        throw error
      }

      if (!recovery || recovery.deletedCount <= 0) {
        console.error('[pipeline] Atlas quota recovery found no eligible expired jobs to remove.')
        throw error
      }

      console.warn(
        `[pipeline] Atlas quota recovery removed ${recovery.deletedCount} expired jobs ` +
        `(~${(recovery.estimatedBytes / (1024 * 1024)).toFixed(1)} MB); retrying the blocked write once.`,
      )
      return operation()
    }
  }, retryOptions)
}

const NON_RETRIABLE_SOFT_FAILURE_KINDS = new Set([
  'blocked_or_access_denied',
  'surface_drift_or_fail_closed',
  'upstream_response_pending',
  'parser_or_contract_error',
])

export const applyRetryPolicyToScraperError = (error) => {
  if (error == null || (typeof error !== 'object' && typeof error !== 'function')) {
    return error
  }

  const classification = classifyScraperError(error)
  if (classification.softFailure !== true) {
    if (isProgrammingError(error) || ['parser_or_contract_error', 'configuration_error'].includes(classification.failureKind)) error.abortRetries = true
    return error
  }

  error.softFailure = true
  error.upstreamOutage = classification.upstreamOutage
  error.failureKind = classification.failureKind

  if (
    error.abortRetries == null
    && NON_RETRIABLE_SOFT_FAILURE_KINDS.has(classification.failureKind)
  ) {
    error.abortRetries = true
  }

  return error
}

const runScraperAttemptWithRetryPolicy = async (scraper, { signal = null } = {}) => {
  try {
    return await runScraperWithTimeout(scraper, undefined, { signal })
  } catch (error) {
    throw applyRetryPolicyToScraperError(error)
  }
}

// Prepare local recovery state before remote lease acquisition can stop startup.
export const prepareScraperRun = ({
  scrapers = buildScrapers(),
  checkpointFile = process.env.SCRAPER_CHECKPOINT_FILE,
  runId = process.env.SCRAPER_RUN_ID || process.env.PIPELINE_ID || process.env.GITHUB_RUN_ID,
} = {}) => {
  const selected = selectScrapersForRun(scrapers)
  selected.scrapers = isolateDryRunSnapshots(selected.scrapers)
  const checkpoint = checkpointFile
    ? openRunCheckpoint({
        filePath: checkpointFile,
        sources: selected.scrapers.map((scraper) => scraper.name),
        mode: isDryRun ? 'dry-run' : 'live',
        parallel: isParallel,
        runId,
      })
    : null
  const pendingSourceNames = new Set(
    checkpoint?.pendingSources(selected.scrapers.map((scraper) => scraper.name))
      ?? selected.scrapers.map((scraper) => scraper.name),
  )
  const pendingScrapers = selected.scrapers.filter((scraper) => pendingSourceNames.has(scraper.name))
  const resumeMessage = checkpoint && pendingScrapers.length < selected.scrapers.length
    ? `Checkpoint resume: ${pendingScrapers.length}/${selected.scrapers.length} sources remain.`
    : selected.resumeMessage
  const summary = checkpoint?.completedSummary() || {}
  return { scrapers: pendingScrapers, checkpoint, summary, resumeMessage }
}

export const finishStoppedScraperRun = (error, {
  checkpoint = null, summary = {}, scrapers = null, interruptedBy = null,
} = {}) => {
  const stopReason = interruptedBy ? 'interrupted'
    : error instanceof MongoRunLeaseHeldError ? 'run_lease_held'
      : isMongoOperationalError(error) ? 'database_unavailable' : 'runner_error'
  checkpoint?.finish({
    interruptedBy: interruptedBy || stopReason,
    error: stopReason === 'run_lease_held' ? error.message : stopReason,
    persistencePending: Boolean(summary.persistencePending),
  })
  const result = summarizeScraperRun(Object.values(summary), { interrupted: true, persistencePending: summary.persistencePending })
  return {
    ...result,
    pendingEstimate: Math.max(result.pendingEstimate, checkpoint?.snapshot().remainingCount ?? scrapers?.length ?? 1),
    stopReason,
    retryable: ['run_lease_held', 'database_unavailable', 'interrupted'].includes(stopReason),
    processingComplete: false,
    handoffReady: false,
    checkpointRetained: Boolean(checkpoint && fs.existsSync(checkpoint.filePath)),
    ...(stopReason === 'run_lease_held' ? {
      lease: Object.fromEntries(['ownerId', 'runId', 'hostname', 'pid', 'expiresAt'].map(key => [key, error.lease[key] ?? null])),
      leaseWaitedMs: error.waitedMs ?? 0,
    } : {}),
  }
}

// Runs all scrapers sequentially and saves results to MongoDB.
export const runAll = async ({ stopSignal = null, preparedRun = null } = {}) => {
  assertLiveMongoUriConfigured()
  initializeScraperProxyEnvironment()
  const { scrapers, checkpoint, summary, resumeMessage } = preparedRun || prepareScraperRun()
  const startTime = Date.now()
  const startedAt = new Date(startTime)
  const lifecycleAttemptId = checkpoint?.snapshot().createdAt || startedAt.toISOString()
  const checkpointHeartbeat = checkpoint
    ? setInterval(() => checkpoint.heartbeat({
        pid: process.pid,
        rssBytes: process.memoryUsage().rss,
        heapUsedBytes: process.memoryUsage().heapUsed,
      }), 30_000)
    : null
  checkpointHeartbeat?.unref?.()

  console.log(`\n${'='.repeat(60)}`)
  console.log(`  Jobverify Scraper Pipeline - ${isDryRun ? 'DRY RUN' : 'LIVE'} | ${isParallel ? 'PARALLEL' : 'SEQUENTIAL'}`)
  console.log(`  Started: ${formatIstTimestamp(startedAt)}`)
  console.log(`${'='.repeat(60)}\n`)
  if (resumeMessage) console.log(`[runner] ${resumeMessage}\n`)

  // Ensure active scrapers are seeded in the database
  if (!isDryRun) {
    try {
      await retryAfterMongoQuotaRecovery(() => ensureScrapersSeeded())
    } catch (seedErr) {
      if (isMongoOperationalError(seedErr)) {
        console.warn(`[runner] Database unavailable during status seeding; leaving sources pending: ${seedErr.message}`)
        for (const scraper of scrapers) summary[scraper.name] = pendingPersistenceResult(seedErr)
        if (!scrapers.length) deferRunPersistence(summary)
        checkpoint?.finish({ persistencePending: Boolean(summary.persistencePending) })
        if (checkpointHeartbeat) clearInterval(checkpointHeartbeat)
        return summary
      }
      const fatalPersistenceError = toFatalScraperPersistenceError(
        '[pipeline] Failed while seeding scraper status records; aborting run',
        seedErr,
        { required: true },
      )
      console.error(`  ${fatalPersistenceError.message}`)
      throw fatalPersistenceError
    }
  }

  if (!isDryRun && shouldClearExistingJobsBeforeRun()) {
    console.log(
      '[runner] Preserving existing live jobs during the full scraper run; stale roles expire source-by-source after successful persistence.\n',
    )
  }

  if (!isDryRun) {
    try {
      await retryAfterMongoQuotaRecovery(() => markPipelineRunStarted(startedAt))
    } catch (pipelineErr) {
      if (isMongoOperationalError(pipelineErr)) {
        console.warn(`[runner] Pipeline start reporting deferred: ${pipelineErr.message}`)
        deferRunPersistence(summary)
      } else {
        const fatalPersistenceError = toFatalScraperPersistenceError(
          '[pipeline] Failed while marking the pipeline as running; aborting run',
          pipelineErr,
          { required: true },
        )
        console.error(`  ${fatalPersistenceError.message}`)
        throw fatalPersistenceError
      }
    }
  }

  if (isParallel) {
    try {
      const parallelSummary = await runAllParallel({
        startedAt,
        scrapers,
        resumeMessage,
        summary,
        checkpoint,
        stopSignal,
        lifecycleAttemptId,
      })
      checkpoint?.finish({
        interruptedBy: stopSignal?.aborted ? (stopSignal.reason?.signalName || 'signal') : null,
        persistencePending: Boolean(parallelSummary.persistencePending),
      })
      return parallelSummary
    } catch (error) {
      checkpoint?.finish({ error: error.message })
      throw error
    } finally {
      if (checkpointHeartbeat) clearInterval(checkpointHeartbeat)
    }
  }

  let startedCount = 0
  const totalScrapers = scrapers.length

  for (const scraper of scrapers) {
    if (stopSignal?.aborted) break
    startedCount++
    const progressStr = `[${startedCount}/${totalScrapers}] `
    const scraperStart = Date.now()
    const logStage = createSourceStageLogger(scraper.name)
    checkpoint?.markSourceStarted(scraper.name)

    // Skip execution if the scraper has been deactivated by an administrator
    if (!isDryRun) {
      try {
        const status = await retryAfterMongoQuotaRecovery(() => ScraperStatus.findOne({ source: scraper.name }).lean().exec(), { signal: stopSignal })
        if (status && status.isActive === false) {
          console.log(`  WARN ${progressStr}[${scraper.name}] is currently deactivated (isActive = false). Skipping run.\n`)
          const skippedResult = {
            success: true,
            skipped: true,
            jobs: 0,
            durationMs: Date.now() - scraperStart,
          }
          summary[scraper.name] = skippedResult
          checkpoint?.markSourceCompleted(scraper.name, skippedResult)
          continue
        }
      } catch (dbErr) {
        console.error(`  ERROR ${progressStr}[${scraper.name}] Failed to verify active status from DB:`, dbErr.message)
        if (isMongoOperationalError(dbErr)) {
          summary[scraper.name] = pendingPersistenceResult(dbErr)
          continue
        }
        throw toFatalScraperPersistenceError(`[pipeline] Failed to read status for [${scraper.name}]; aborting run`, dbErr, { required: true })
      }
    }

    console.log(`${progressStr}Running [${scraper.name}]...`)

    if (isDryRun) clearDryRunArtifact(scraper.dryRunFile)
    let rawCaptureFile = null
    let capturedAt = null
    let processingStarted = false
    let attemptDiagnostics = {}
    let scrapeOperation
    try {
      scrapeOperation = withRetry(
        () => runScraperAttemptWithRetryPolicy(scraper, { signal: stopSignal }),
        {
          attempts: resolveScraperRetryAttempts(scraper),
          baseDelayMs: 2000,
          label: scraper.name,
          signal: stopSignal,
        },
      )
      const jobs = await scrapeOperation
      if (!Array.isArray(jobs) || jobs.some(job => !job || typeof job !== 'object' || Array.isArray(job))) {
        throw new Error(`[${scraper.name}] Expected an array of job records from the scraper`)
      }
      processingStarted = true
      capturedAt = new Date()
      rawCaptureFile = await saveRawSourceCapture(jobs, { source: scraper.name, dryRun: isDryRun, now: capturedAt })
      const publishableAnalysis = analyzePublishableJobs(jobs)
      attemptDiagnostics = buildScraperAttemptDiagnostics(jobs, publishableAnalysis, scraper.provider || { source: scraper.name })
      const indiaJobs = publishableAnalysis.indiaJobs
      const zeroJobEvidence = resolveZeroJobOutcome(scraper, jobs, indiaJobs)
      const cities = [...new Set(indiaJobs.map(j => j.city).filter(Boolean))].sort()

      let result
      if (isDryRun) {
        await queueProviderDescriptions(indiaJobs, scraper, { capturedAt, captureFile: rawCaptureFile })
        await saveDryRunSnapshot(
          indiaJobs,
          scraper.dryRunFile,
          buildDryRunSnapshotOptions({ scraper, signal: stopSignal, onStage: logStage, capturedAt, captureFile: rawCaptureFile }),
        )
        result = {
          jobs: indiaJobs.length,
          eligibleJobs: publishableAnalysis.eligibleJobs.length,
          filteredNonIndia: publishableAnalysis.filterCounts.nonIndia,
          filteredClosed: publishableAnalysis.filterCounts.closed,
          filteredInvalidUrl: publishableAnalysis.filterCounts.invalidUrl,
          filteredEmptyDescription: publishableAnalysis.filterCounts.emptyDescription,
          cities,
          mode: 'dry-run',
          file: scraper.dryRunFile,
        }
      } else {
        result = await saveToDB(jobs, scraper.name, {
          ...inventoryCleanupOptions(attemptDiagnostics),
          refreshDatasetSummary: false,
          authoritativeEmpty: zeroJobEvidence === 'verified-empty',
          enrichPublicExperience: resolveLivePublicExperienceEnabled(scraper),
          signal: stopSignal,
          onStage: logStage,
          lifecycleAttemptId,
        })
        result.jobs = indiaJobs.length
        result.cities = cities
      }

      if (zeroJobEvidence) result.zeroJobEvidence = zeroJobEvidence
      result.retry = getRetryMetadata(jobs)
      result.retryPressure = getRetryPressure(scrapeOperation)
      result.durationMs = Date.now() - scraperStart
      summary[scraper.name] = finishScraperProcessing({
        success: true,
        ...result,
        ...attemptDiagnostics,
        attemptedAt: new Date(scraperStart).toISOString(),
        completedAt: new Date().toISOString(),
      })
      logSourceCompletion(scraper, summary[scraper.name])
    } catch (err) {
      await saveRawSourceFailure(err, { source: scraper.name, dryRun: isDryRun, captureFile: rawCaptureFile })
      if (err instanceof LocalJobOutboxPersistenceError) throw err
      // Interrupted work must remain pending so the checkpoint resumes it.
      if (stopSignal?.aborted) break
      const fatalPersistenceError = toFatalScraperPersistenceError(
        `[pipeline] MongoDB writes are blocked while persisting jobs for [${scraper.name}]; aborting run`,
        err,
      )
      if (fatalPersistenceError) {
        console.error(`  ${fatalPersistenceError.message}`)
        throw fatalPersistenceError
      }
      rethrowInfrastructureError(err, { processingStarted })
      const classification = classifyScraperError(err)
      const failureResult = {
        success: false,
        ...attemptDiagnostics,
        attemptedAt: new Date(scraperStart).toISOString(),
        completedAt: new Date().toISOString(),
        error: err.message,
        ...(err.classificationPending ? { classificationPending: true } : {}),
        retry: getRetryMetadata(err),
        retryPressure: getRetryPressure(scrapeOperation),
        durationMs: Date.now() - scraperStart,
        ...classification,
        ...(err.partial === true ? { partial: true } : {}),
        ...(isMongoOperationalError(err, { networkCodes: processingStarted }) ? pendingPersistenceResult(err) : {}),
      }
      const failureLabel = failureResult.softFailure ? 'UPSTREAM:' : 'SOURCE FAILED:'
      console.warn(`  WARN [${scraper.name}] ${failureLabel}`, err.message)
      summary[scraper.name] = failureResult
    }

    if (!isDryRun) {
      await updateLiveScraperStatus(scraper.name, summary[scraper.name], logStage)
    }

    if (!hasPendingPersistence(summary[scraper.name])) checkpoint?.markSourceCompleted(scraper.name, summary[scraper.name])

    console.log()
  }

  const totalMs = Date.now() - startTime
  console.log(`${'='.repeat(60)}`)
  console.log(`  Pipeline ${stopSignal?.aborted ? 'stopped' : 'complete'} in ${(totalMs / 1000).toFixed(1)}s`)
  console.log(`${'='.repeat(60)}\n`)

  if (!isDryRun) {
    await refreshVisibleDatasetSummaryWithLogging()
  }

  if (!isDryRun) {
    try {
      await retryAfterMongoQuotaRecovery(() => writeScraperRun(new Date(startTime), summary))
    } catch (dbErr) {
      console.error(`  ERROR Failed to save run history to DB:`, dbErr.message)
      if (!isMongoOperationalError(dbErr)) throw dbErr
      deferRunPersistence(summary)
    }
  }

  if (!isDryRun) {
    try {
      await retryAfterMongoQuotaRecovery(() => markPipelineRunFinished({
        startedAt,
        completedAt: new Date(),
        aborted: Boolean(stopSignal?.aborted),
        error: stopSignal?.aborted
          ? `Pipeline stopped by ${stopSignal.reason?.signalName || 'signal'}.`
          : null,
      }))
    } catch (pipelineErr) {
      console.error(`  [pipeline] Failed to mark pipeline as complete:`, pipelineErr.message)
      if (!isMongoOperationalError(pipelineErr)) throw toFatalScraperPersistenceError('[pipeline] Failed to mark pipeline as complete; aborting run', pipelineErr, { required: true })
      deferRunPersistence(summary)
    }
  }

  Object.defineProperty(summary, 'runTiming', {
    value: { startedAt, completedAt: new Date() },
  })
  checkpoint?.finish({
    interruptedBy: stopSignal?.aborted ? (stopSignal.reason?.signalName || 'signal') : null,
    persistencePending: Boolean(summary.persistencePending),
  })
  if (checkpointHeartbeat) clearInterval(checkpointHeartbeat)
  return summary
}

// Runs a single scraper with retry, saves results, and updates live status.
export const runScraper = async (
  scraper,
  progressStr = '',
  persistenceOptions = {},
) => {
  const scraperStart = Date.now()
  const stageLogger = createSourceStageLogger(scraper.name)
  const logStage = event => {
    if (event.stage === 'classification') {
      if (event.status === 'start') persistenceOptions.pauseTimeout?.()
      if (['done', 'error'].includes(event.status)) persistenceOptions.resumeTimeout?.()
    }
    stageLogger(event)
  }

  // Skip execution if the scraper has been deactivated by an administrator
  if (!isDryRun) {
    try {
      const status = await retryAfterMongoQuotaRecovery(() => ScraperStatus.findOne({ source: scraper.name }).lean().exec(), { signal: persistenceOptions.signal })
      if (status && status.isActive === false) {
        console.log(`  WARN ${progressStr}[${scraper.name}] is currently deactivated (isActive = false). Skipping run.\n`)
        return { name: scraper.name, success: true, skipped: true, jobs: 0, eligibleJobs: 0, inserted: 0, updated: 0, deleted: 0, filteredOld: 0, missed: 0, expired: 0, durationMs: 0 }
      }
    } catch (dbErr) {
      console.error(`  ERROR ${progressStr}[${scraper.name}] Failed to verify active status from DB:`, dbErr.message)
      if (isMongoOperationalError(dbErr)) return { name: scraper.name, ...pendingPersistenceResult(dbErr) }
      throw toFatalScraperPersistenceError(`[pipeline] Failed to read status for [${scraper.name}]; aborting run`, dbErr, { required: true })
    }
  }

  console.log(`${progressStr}Starting [${scraper.name}]...`)
  const lifecycleSignal = persistenceOptions.signal || null

  if (isDryRun) clearDryRunArtifact(scraper.dryRunFile)
  let rawCaptureFile = null
  let capturedAt = null
  let processingStarted = false
  let attemptDiagnostics = {}
  let scrapeOperation
  try {
    throwIfAborted(lifecycleSignal)
    const scrapeStageStart = Date.now()
    logStage({ stage: 'scrape', status: 'start' })
    scrapeOperation = withRetry(
      () => runScraperAttemptWithRetryPolicy(scraper, { signal: lifecycleSignal }),
      {
        attempts: resolveScraperRetryAttempts(scraper),
        baseDelayMs: 2000,
        label: scraper.name,
        signal: lifecycleSignal,
      },
    )
    const jobs = await scrapeOperation
    if (!Array.isArray(jobs) || jobs.some(job => !job || typeof job !== 'object' || Array.isArray(job))) {
      throw new Error(`[${scraper.name}] Expected an array of job records from the scraper`)
    }
    processingStarted = true
    capturedAt = new Date()
    rawCaptureFile = await saveRawSourceCapture(jobs, { source: scraper.name, dryRun: isDryRun, now: capturedAt })
    logStage({
      stage: 'scrape',
      status: 'done',
      durationMs: Date.now() - scrapeStageStart,
      jobs: Array.isArray(jobs) ? jobs.length : undefined,
    })
    throwIfAborted(lifecycleSignal)
    const retry = getRetryMetadata(jobs)
    const publishableAnalysis = analyzePublishableJobs(jobs)
    attemptDiagnostics = buildScraperAttemptDiagnostics(jobs, publishableAnalysis, scraper.provider || { source: scraper.name })
    const indiaJobs = publishableAnalysis.indiaJobs
    const zeroJobEvidence = resolveZeroJobOutcome(scraper, jobs, indiaJobs)
    const dataQuality = indiaJobs.reduce((total, job = {}) => ({
      missingTitle: total.missingTitle + (!String(job.title || '').trim() ? 1 : 0),
      missingLocation: total.missingLocation + (!String(job.location || job.city || '').trim() ? 1 : 0),
      missingApplyUrl: total.missingApplyUrl + (!String(job.applyUrl || job.link || '').trim() ? 1 : 0),
    }), { missingTitle: 0, missingLocation: 0, missingApplyUrl: 0 })
    const cities = [...new Set(indiaJobs.map(j => j.city).filter(Boolean))].sort()

    let result
    if (isDryRun) {
      await queueProviderDescriptions(indiaJobs, scraper, { capturedAt, captureFile: rawCaptureFile })
      await saveDryRunSnapshot(
        indiaJobs,
        scraper.dryRunFile,
        buildDryRunSnapshotOptions({ scraper, signal: lifecycleSignal, onStage: logStage, capturedAt, captureFile: rawCaptureFile }),
      )
      result = {
        jobs: indiaJobs.length,
        eligibleJobs: publishableAnalysis.eligibleJobs.length,
        filteredNonIndia: publishableAnalysis.filterCounts.nonIndia,
        filteredClosed: publishableAnalysis.filterCounts.closed,
        filteredInvalidUrl: publishableAnalysis.filterCounts.invalidUrl,
        filteredEmptyDescription: publishableAnalysis.filterCounts.emptyDescription,
        cities,
        mode: 'dry-run',
        file: scraper.dryRunFile,
      }
    } else {
      result = await saveToDB(jobs, scraper.name, {
        ...persistenceOptions,
        ...inventoryCleanupOptions(attemptDiagnostics),
        refreshDatasetSummary: false,
        authoritativeEmpty: zeroJobEvidence === 'verified-empty',
        enrichPublicExperience: resolveLivePublicExperienceEnabled(scraper),
        signal: lifecycleSignal,
        onStage: logStage,
      })
      result.jobs = indiaJobs.length
      result.cities = cities
    }

    throwIfAborted(lifecycleSignal)
    if (zeroJobEvidence) result.zeroJobEvidence = zeroJobEvidence
    result.retry = retry
    result.retryPressure = getRetryPressure(scrapeOperation)
    result.dataQuality = dataQuality
    result.durationMs = Date.now() - scraperStart
    const successResult = finishScraperProcessing({
      success: true,
      ...result,
      ...attemptDiagnostics,
      attemptedAt: new Date(scraperStart).toISOString(),
      completedAt: new Date().toISOString(),
    })
    logSourceCompletion(scraper, successResult)

    await updateLiveScraperStatus(scraper.name, successResult, logStage)
    throwIfAborted(lifecycleSignal)

    return { name: scraper.name, ...successResult }
  } catch (err) {
    await saveRawSourceFailure(err, { source: scraper.name, dryRun: isDryRun, captureFile: rawCaptureFile })
    if (err instanceof LocalJobOutboxPersistenceError) throw err
    const fatalPersistenceError = toFatalScraperPersistenceError(
      `[pipeline] MongoDB writes are blocked while persisting jobs for [${scraper.name}]; aborting run`,
      err,
    )
    if (fatalPersistenceError) {
      console.error(`  ${fatalPersistenceError.message}`)
      throw fatalPersistenceError
    }
    rethrowInfrastructureError(err, { processingStarted })
    const classification = classifyScraperError(err)
    const failResult = {
      success: false,
      ...attemptDiagnostics,
      attemptedAt: new Date(scraperStart).toISOString(),
      completedAt: new Date().toISOString(),
      error: err.message,
      ...(err.classificationPending ? { classificationPending: true } : {}),
      retry: getRetryMetadata(err),
      retryPressure: getRetryPressure(scrapeOperation),
      durationMs: Date.now() - scraperStart,
      ...classification,
      ...(err.partial === true ? { partial: true } : {}),
      ...(isMongoOperationalError(err, { networkCodes: processingStarted }) ? pendingPersistenceResult(err) : {}),
    }
    const failureLabel = failResult.softFailure ? 'UPSTREAM:' : 'SOURCE FAILED:'
    console.warn(`  WARN [${scraper.name}] ${failureLabel}`, err.message)

    await updateLiveScraperStatus(scraper.name, failResult, logStage)

    return { name: scraper.name, ...failResult }
  }
}

// Runs all scrapers in a concurrency-limited worker pool to balance speed and host stability.
const runAllParallel = async ({
  startedAt = new Date(),
  scrapers = selectScrapersForRun(buildScrapers()).scrapers,
  resumeMessage = null,
  summary = {},
  checkpoint = null,
  stopSignal = null,
  lifecycleAttemptId = startedAt.toISOString(),
} = {}) => {
  const startTime = Date.now()
  let previousRun = null
  if (!isDryRun) {
    try {
      previousRun = await readPreviousScraperRun(startedAt)
    } catch (error) {
      console.error(`[runner] Previous-run analytics unavailable: ${error.message}`)
    }
  }
  const {
    effective: concurrencyLimit,
  } = resolveParallelWorkerConcurrency()
  const queue = [...scrapers]
  if (resumeMessage) console.log(`[runner] ${resumeMessage}`)
  console.log(`[runner] Launching parallel worker pool with concurrency limit: ${concurrencyLimit}`)

  let startedCount = 0
  let completedCount = 0
  const totalScrapers = scrapers.length
  let fatalWorkerError = null
  const pipelineController = new AbortController()
  const detachStopSignal = attachParentAbort(stopSignal, pipelineController)

  // Worker loop that drains the shared queue
  const worker = async () => {
    while (queue.length > 0) {
      if (fatalWorkerError) break
      if (stopSignal?.aborted) break

      const scraper = queue.shift()
      if (!scraper) continue

      startedCount++
      const sourceStartedAt = Date.now()
      const progressStr = `[${startedCount}/${totalScrapers}] `
      let result
      let escapedError = null
      checkpoint?.markSourceStarted(scraper.name)
      try {
        result = await withSourceLifecycleTimeout(
          scraper,
          ({ signal, pauseTimeout, resumeTimeout }) => runScraper(
            scraper,
            progressStr,
            { signal, pauseTimeout, resumeTimeout, lifecycleAttemptId },
          ),
          resolveSourceLifecycleTimeoutMs(undefined, scraper),
          { signal: pipelineController.signal },
        )
      } catch (error) {
        const failureResult = {
          name: scraper.name,
          success: false,
          error: error.message,
          durationMs: Date.now() - sourceStartedAt,
          ...classifyScraperError(error),
        }
        if (error instanceof ScraperSourceLifecycleTimeoutError) {
          console.warn(`  WARN [${scraper.name}] SOURCE FAILED:`, error.message)
          try {
            await updateLiveScraperStatus(
              scraper.name,
              failureResult,
              createSourceStageLogger(scraper.name),
            )
            result = failureResult
          } catch (statusError) {
            escapedError = statusError
          }
        } else {
          escapedError = error
        }

        if (escapedError) {
          // Persistence failures and unexpected errors still stop the queue.
          fatalWorkerError ||= escapedError
          queue.length = 0
          pipelineController.abort(fatalWorkerError)
          result = {
            ...failureResult,
            error: escapedError.message,
            ...classifyScraperError(escapedError),
          }
        }
      }
      const { name, ...rest } = result
      summary[name] = rest
      if (!escapedError && !hasPendingPersistence(rest) && !stopSignal?.aborted) checkpoint?.markSourceCompleted(name, rest)
      
      completedCount++
      console.log(`${formatParallelProgressLog(completedCount, totalScrapers)}\n`)
    }
  }

  // Launch workers up to the concurrency limit or the number of scrapers, whichever is smaller
  const activeWorkers = Array.from(
    { length: Math.min(concurrencyLimit, scrapers.length) },
    worker
  )

  // Wait for all workers to finish draining the queue
  try { await Promise.all(activeWorkers) }
  finally { detachStopSignal() }

  if (!isDryRun) {
    await refreshVisibleDatasetSummaryWithLogging()
  }

  if (!isDryRun) {
    try {
      await retryAfterMongoQuotaRecovery(() => writeScraperRun(new Date(startTime), summary))
    } catch (dbErr) {
      console.error(`  ERROR Failed to save run history to DB:`, dbErr.message)
      if (!isMongoOperationalError(dbErr)) throw dbErr
      deferRunPersistence(summary)
    }
  }

  if (!isDryRun) {
    try {
      await retryAfterMongoQuotaRecovery(() => markPipelineRunFinished({
        startedAt,
        completedAt: new Date(),
        aborted: Boolean(stopSignal?.aborted || fatalWorkerError),
        error: fatalWorkerError?.message || (
          stopSignal?.aborted
            ? `Pipeline stopped by ${stopSignal.reason?.signalName || 'signal'}.`
            : null
        ),
      }))
    } catch (pipelineErr) {
      console.error(`  [pipeline] Failed to mark pipeline as complete:`, pipelineErr.message)
      if (!isMongoOperationalError(pipelineErr)) throw toFatalScraperPersistenceError('[pipeline] Failed to mark pipeline as complete; aborting run', pipelineErr, { required: true })
      deferRunPersistence(summary)
    }
  }

  Object.defineProperties(summary, {
    previousRun: { value: previousRun },
    runTiming: { value: { startedAt, completedAt: new Date() } },
  })
  if (fatalWorkerError) throw fatalWorkerError
  return summary
}

const directExecutionModulePath = resolveExecutionPath(fileURLToPath(import.meta.url))

// Run when invoked directly: node scraper-support/runner.js [--dry-run] [--parallel]
if (resolveExecutionPath(process.argv[1]) === directExecutionModulePath) {
  const shutdown = installGracefulShutdownHandlers()
  let runLease = null
  let preparedRun = null
  try {
    // Validate bounded dry-run selection before preparing the database runtime.
    if (String(process.env.SCRAPER_FIRST_N || '').trim()) selectScrapersForRun([], { dryRun: isDryRun })
    assertLiveMongoUriConfigured()
    validateRecruitmentBatchAssets()
    preparedRun = prepareScraperRun()
    if (!isDryRun && !/^(?:0|false|no)$/i.test(String(process.env.SCRAPER_RUN_LEASE || '1'))) {
      runLease = await waitForMongoRunLease({
        waitTimeoutMs: Number(String(process.env.SCRAPER_RUN_LEASE_WAIT_MS || '').trim() || DEFAULT_RUN_LEASE_WAIT_MS),
        signal: shutdown.signal,
        onWait: (error, { delayMs }) => console.warn(`[runner] Waiting for live-run lease; retrying in ${delayMs}ms. ${error.message}`),
        acquire: () => retryAfterMongoQuotaRecovery(() => acquireMongoRunLease({
          runId: process.env.SCRAPER_RUN_ID || process.env.PIPELINE_ID || process.env.GITHUB_RUN_ID || null,
          onLost: (error) => {
            console.error(`[runner] MongoDB run lease lost: ${error.message}`)
            shutdown.request('SIGTERM')
          },
        }), { signal: shutdown.signal }),
      })
      console.log(`[runner] Acquired exclusive live-run lease (${runLease.ownerId}).`)
    }

    const summary = await runAll({ stopSignal: shutdown.signal, preparedRun })
    const tableData = Object.keys(summary).map((source) => {
      const result = summary[source]

      return {
        Source: source,
        Status: result.success
          ? 'OK'
          : (result.skipped ? 'Skip' : (result.softFailure ? 'Upstream' : 'Warn')),
        Jobs: result.jobs || 0,
        New: result.inserted || 0,
        Updated: result.updated || 0,
        Time: `${((result.durationMs || 0) / 1000).toFixed(1)}s`,
      }
    })

    console.log('\nFinal Pipeline Summary:')
    console.log(formatFinalSummaryTable(summary, {
      previousRun: summary.previousRun,
      runTiming: summary.runTiming,
    }))

    const rows = Object.values(summary)
    const pipelineSummary = summarizeScraperRun(rows, { interrupted: shutdown.requested, persistencePending: summary.persistencePending })
    const warnings = pipelineSummary.warnings
    if (warnings > 0) {
      console.warn(`[runner] Recorded ${warnings} source warning(s). See source diagnostics above.`)
    }
    if (Object.values(summary).some(hasPendingPersistence)) {
      console.warn('Some sources have unfinished persistence. Resume this checkpoint to retry.')
    }
    if (shutdown.requested) process.exitCode = shutdown.exitCode
    writePipelineSummary(pipelineSummary)
  } catch (err) {
    const stopped = finishStoppedScraperRun(err, { ...preparedRun, interruptedBy: shutdown.signalName })
    writePipelineSummary(stopped)
    const recovery = stopped.checkpointRetained ? 'checkpoint saved for recovery' : 'no resumable checkpoint was saved'
    if (err instanceof MongoRunLeaseHeldError) {
      console.warn(`[runner] Run lease unavailable; ${recovery}:`, err.message)
      process.exitCode = err.exitCode
    } else if (shutdown.requested) {
      console.warn(`[runner] Startup interrupted; ${recovery}.`)
      process.exitCode = shutdown.exitCode
    } else if (isMongoOperationalError(err)) {
      console.warn(`[runner] Database unavailable; ${recovery}:`, err.message)
      process.exitCode = 0
    } else {
      console.error('Pipeline error:', err)
      process.exitCode = Number.isInteger(err?.exitCode) ? err.exitCode : 1
    }
  } finally {
    try {
      await runLease?.release()
    } catch (error) {
      console.error('[runner] Failed to release MongoDB run lease:', error.message)
      if (!isMongoOperationalError(error)) process.exitCode = process.exitCode || 1
    }
    shutdown.dispose()
  }

  finalizeDirectRunnerExit()
}
