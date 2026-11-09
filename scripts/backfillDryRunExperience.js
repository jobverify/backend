import fs from 'node:fs/promises'
import { realpathSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserFetchSession } from '../scraper-support/shared/browserFetch.js'
import { buildScrapers } from '../scraper-support/providers/index.js'
import { saveDryRunSnapshot } from '../scraper-support/utils/saveToDB.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const defaultScraperDir = path.resolve(currentDir, '../scraper')
const resolveExecutionPath = (value) => {
  if (value == null || value === '') return null

  const absolutePath = path.resolve(String(value))
  try {
    return realpathSync.native(absolutePath)
  } catch {
    return absolutePath
  }
}
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const findArgValue = (name) => {
  const prefix = `${name}=`
  const direct = process.argv.find((value) => value.startsWith(prefix))
  return direct ? direct.slice(prefix.length) : null
}

const hasFlagArg = (name) => process.argv.includes(name)

const normalizeRequestedSource = (value) => String(value ?? '').trim().toLowerCase()

export const decodePossiblyUtf16Text = (buffer) => {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer ?? '')
  if (bytes.length === 0) return ''

  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return bytes.subarray(2).toString('utf16le')
  }

  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    const swapped = Buffer.allocUnsafe(Math.max(0, bytes.length - 2))
    for (let index = 2; index + 1 < bytes.length; index += 2) {
      swapped[index - 2] = bytes[index + 1]
      swapped[index - 1] = bytes[index]
    }
    return swapped.toString('utf16le')
  }

  const utf8 = bytes.toString('utf8')
  if (utf8.includes('\u0000')) {
    return bytes.toString('utf16le')
  }

  return utf8
}

export const extractCompletedSourceDirectoryNamesFromPipelineLogText = (value = '') => {
  const matches = String(value ?? '').matchAll(
    /jobverify-backend\\scraper\\([^\\\r\n]+)\\jobs\.json/gi,
  )

  return [...new Set(
    [...matches]
      .map((match) => normalizeRequestedSource(match[1]))
      .filter(Boolean),
  )]
}

export const parseRequestedSourceFilter = (value = '') => new Set(
  String(value || '')
    .split(',')
    .map((entry) => normalizeRequestedSource(entry))
    .filter(Boolean),
)

export const buildRequestedSourceDirectoryOrder = (
  requestedSources = new Set(),
  scrapers = buildScrapers(),
) => {
  const normalizedSources = requestedSources instanceof Set
    ? [...requestedSources]
      .map((value) => normalizeRequestedSource(value))
      .filter(Boolean)
    : parseRequestedSourceFilter(requestedSources)

  const orderedDirectoryNames = []
  const seen = new Set()
  const pushUnique = (value) => {
    const normalizedValue = normalizeRequestedSource(value)
    if (!normalizedValue || seen.has(normalizedValue)) return
    seen.add(normalizedValue)
    orderedDirectoryNames.push(normalizedValue)
  }

  for (const source of normalizedSources) {
    pushUnique(source)
  }

  for (const scraper of Array.isArray(scrapers) ? scrapers : []) {
    const scraperSource = normalizeRequestedSource(scraper?.name || scraper?.provider?.source)
    if (!scraperSource || !normalizedSources.includes(scraperSource)) continue

    const dryRunFile = String(scraper?.dryRunFile || '').trim()
    if (!dryRunFile) continue

    const directoryName = normalizeRequestedSource(path.basename(path.dirname(dryRunFile)))
    pushUnique(directoryName)
  }

  return orderedDirectoryNames
}

export const buildRequestedSourceDirectoryNames = (
  requestedSources = new Set(),
  scrapers = buildScrapers(),
) => new Set(
  buildRequestedSourceDirectoryOrder(requestedSources, scrapers),
)

export const prioritizeBackfillTargets = (
  targets = [],
  requestedSourceOrder = [],
) => {
  const normalizedOrder = Array.isArray(requestedSourceOrder)
    ? requestedSourceOrder
      .map((value) => normalizeRequestedSource(value))
      .filter(Boolean)
    : buildRequestedSourceDirectoryOrder(requestedSourceOrder)
  const requestedIndexBySource = new Map(
    normalizedOrder.map((source, index) => [source, index]),
  )

  return [...targets].sort((left, right) => {
    const leftIndex = requestedIndexBySource.get(normalizeRequestedSource(left?.source))
    const rightIndex = requestedIndexBySource.get(normalizeRequestedSource(right?.source))
    const leftHasExplicitOrder = Number.isInteger(leftIndex)
    const rightHasExplicitOrder = Number.isInteger(rightIndex)

    if (leftHasExplicitOrder && rightHasExplicitOrder && leftIndex !== rightIndex) {
      return leftIndex - rightIndex
    }
    if (leftHasExplicitOrder !== rightHasExplicitOrder) {
      return leftHasExplicitOrder ? -1 : 1
    }

    return (
      left.jobsFileSize - right.jobsFileSize
      || right.uncheckedMissingBefore - left.uncheckedMissingBefore
      || left.source.localeCompare(right.source, 'en')
    )
  })
}

const sourceFilter = parseRequestedSourceFilter(
  String(findArgValue('--source') || '')
)
const pipelineLogPathArg = String(findArgValue('--pipeline-log') || '').trim()
const pipelineLogPath = pipelineLogPathArg ? path.resolve(pipelineLogPathArg) : null
const auditOnly = hasFlagArg('--audit-only')
const requestedSourceDirectoryOrder = sourceFilter.size === 0
  ? []
  : buildRequestedSourceDirectoryOrder(sourceFilter)
const requestedSourceDirectories = sourceFilter.size === 0
  ? new Set()
  : new Set(requestedSourceDirectoryOrder)

const scraperDir = path.resolve(findArgValue('--scraper-dir') || defaultScraperDir)
const fileConcurrency = toPositiveInt(findArgValue('--file-concurrency'), 1)
const experienceEnrichmentConcurrency = toPositiveInt(findArgValue('--experience-concurrency'), 2)
const progressEvery = toPositiveInt(findArgValue('--progress-every'), 25)
const limit = toPositiveInt(findArgValue('--limit'), 0)
const maxJobsPerSource = toPositiveInt(findArgValue('--max-jobs-per-source'), 0)
const browserFallbackMode = String(findArgValue('--browser-fallback') || 'shared')
  .trim()
  .toLowerCase()
const useSharedBrowserFallback = browserFallbackMode !== 'off'
const browserSessionCount = Math.max(1, Math.min(4, experienceEnrichmentConcurrency))

const shouldProcessSource = (source) => (
  sourceFilter.size === 0
  || requestedSourceDirectories.has(normalizeRequestedSource(source))
)

const summarizeMissingExperience = (jobs = []) => jobs.reduce(
  (count, job) => count + (String(job?.experienceRequired || '').trim() ? 0 : 1),
  0,
)

export const isUncheckedMissingExperienceJob = (job = {}) => (
  !String(job?.experienceRequired || '').trim()
  && job?.publicExperienceChecked !== true
)

const countVerifiedMissingExperience = (jobs = []) => jobs.reduce(
  (count, job) => count + (
    !String(job?.experienceRequired || '').trim()
    && job?.publicExperienceChecked === true
      ? 1
      : 0
  ),
  0,
)

const summarizeUncheckedMissingExperience = (jobs = []) => jobs.reduce(
  (count, job) => count + (isUncheckedMissingExperienceJob(job) ? 1 : 0),
  0,
)

export const selectUncheckedMissingExperienceJobs = (jobs = [], maxJobs = 0) => {
  const selectedJobs = []

  for (const job of Array.isArray(jobs) ? jobs : []) {
    if (!isUncheckedMissingExperienceJob(job)) continue
    selectedJobs.push(job)
    if (Number.isInteger(maxJobs) && maxJobs > 0 && selectedJobs.length >= maxJobs) {
      break
    }
  }

  return selectedJobs
}

const loadJobs = async (jobsPath) => {
  const raw = await fs.readFile(jobsPath, 'utf8')
  const parsed = JSON.parse(raw)
  return Array.isArray(parsed) ? parsed : []
}

const loadCompletedSourceDirectoriesFromPipelineLog = async (logPath) => {
  const raw = await fs.readFile(logPath)
  return new Set(extractCompletedSourceDirectoryNamesFromPipelineLogText(
    decodePossiblyUtf16Text(raw),
  ))
}

const collectTargets = async ({ includeVerifiedMissing = false } = {}) => {
  const completedSourceDirectories = pipelineLogPath
    ? await loadCompletedSourceDirectoriesFromPipelineLog(pipelineLogPath)
    : null
  const entries = (await fs.readdir(scraperDir, { withFileTypes: true }))
    .filter((entry) => (
      entry.isDirectory()
      && shouldProcessSource(entry.name)
      && (
        completedSourceDirectories == null
        || completedSourceDirectories.has(normalizeRequestedSource(entry.name))
      )
    ))
    .sort((left, right) => left.name.localeCompare(right.name, 'en'))

  const targets = []
  for (const entry of entries) {
    const jobsPath = path.join(scraperDir, entry.name, 'jobs.json')
    try {
      const jobs = await loadJobs(jobsPath)
      if (jobs.length === 0) continue

      const missingBefore = summarizeMissingExperience(jobs)
      const uncheckedMissingBefore = summarizeUncheckedMissingExperience(jobs)
      const verifiedMissingBefore = countVerifiedMissingExperience(jobs)
      if ((includeVerifiedMissing ? missingBefore : uncheckedMissingBefore) === 0) continue
      const jobsFileSize = (await fs.stat(jobsPath)).size

      targets.push({
        source: entry.name,
        jobsPath,
        totalJobs: jobs.length,
        missingBefore,
        verifiedMissingBefore,
        uncheckedMissingBefore,
        jobsFileSize,
      })
    } catch (error) {
      if (error?.code === 'ENOENT') continue
      throw error
    }
  }

  const prioritizedTargets = prioritizeBackfillTargets(
    targets,
    requestedSourceDirectoryOrder,
  )

  return limit > 0 ? prioritizedTargets.slice(0, limit) : prioritizedTargets
}

let sharedBrowserSessionPromise = null
let sharedBrowserCursor = 0

const getSharedBrowserSession = async () => {
  if (!useSharedBrowserFallback) return null

  sharedBrowserSessionPromise ??= Promise.all(
    Array.from({ length: browserSessionCount }, () => createBrowserFetchSession({
      userAgent: BROWSER_USER_AGENT,
      timeoutMs: 60000,
      waitUntil: 'networkidle2',
      settleTimeMs: 3000,
    })),
  ).then((sessions) => ({
    sessions,
    queues: sessions.map(() => Promise.resolve()),
  }))

  return sharedBrowserSessionPromise
}

const fetchSharedBrowserText = async (url) => {
  const pool = await getSharedBrowserSession()
  if (!pool) return null

  const sessionIndex = sharedBrowserCursor % pool.sessions.length
  sharedBrowserCursor += 1
  const next = pool.queues[sessionIndex].then(
    () => pool.sessions[sessionIndex].fetchText(url),
    () => pool.sessions[sessionIndex].fetchText(url),
  )
  pool.queues[sessionIndex] = next.catch(() => {})
  return next
}

const closeSharedBrowserSession = async () => {
  if (!sharedBrowserSessionPromise) return

  const pool = await sharedBrowserSessionPromise
  await Promise.allSettled(pool.sessions.map((session) => session.close()))
  sharedBrowserSessionPromise = null
  sharedBrowserCursor = 0
}

const processTarget = async (target) => {
  const jobs = await loadJobs(target.jobsPath)
  const selectedJobs = maxJobsPerSource > 0
    ? selectUncheckedMissingExperienceJobs(jobs, maxJobsPerSource)
    : []

  if (maxJobsPerSource > 0 && selectedJobs.length === 0) {
    return {
      source: target.source,
      jobsPath: target.jobsPath,
      totalJobs: target.totalJobs,
      missingBefore: target.uncheckedMissingBefore,
      missingAfter: target.uncheckedMissingBefore,
      selectedJobCount: 0,
    }
  }

  const rewrittenJobs = await saveDryRunSnapshot(jobs, target.jobsPath, {
    experienceEnrichmentConcurrency,
    fetchBrowserText: useSharedBrowserFallback ? fetchSharedBrowserText : null,
    maxJobsToEnrich: maxJobsPerSource > 0 ? maxJobsPerSource : undefined,
    allowInPlaceRewriteOnEnospc: true,
    shouldEnrichJob: maxJobsPerSource > 0 ? isUncheckedMissingExperienceJob : undefined,
  })

  return {
    source: target.source,
    jobsPath: target.jobsPath,
    totalJobs: target.totalJobs,
    missingBefore: target.uncheckedMissingBefore,
    missingAfter: summarizeUncheckedMissingExperience(rewrittenJobs),
    selectedJobCount: maxJobsPerSource > 0 ? selectedJobs.length : null,
  }
}

async function main() {
  const targets = await collectTargets({ includeVerifiedMissing: auditOnly })
  const results = []
  let cursor = 0
  let completedSources = 0
  let completedMissingBefore = 0
  let completedMissingAfter = 0

  if (auditOnly) {
    const summary = targets.reduce((accumulator, target) => {
      accumulator.auditedSources += 1
      accumulator.totalJobs += target.totalJobs
      accumulator.missingBefore += target.missingBefore
      accumulator.verifiedMissingBefore += target.verifiedMissingBefore
      accumulator.uncheckedMissingBefore += target.uncheckedMissingBefore
      return accumulator
    }, {
      auditedSources: 0,
      totalJobs: 0,
      missingBefore: 0,
      verifiedMissingBefore: 0,
      uncheckedMissingBefore: 0,
    })

    console.log(JSON.stringify({
      event: 'audit-summary',
      scraperDir,
      pipelineLogPath,
      auditedSources: summary.auditedSources,
      totalJobs: summary.totalJobs,
      missingBefore: summary.missingBefore,
      verifiedMissingBefore: summary.verifiedMissingBefore,
      uncheckedMissingBefore: summary.uncheckedMissingBefore,
      results: targets.slice(0, 50).map((target) => ({
        source: target.source,
        totalJobs: target.totalJobs,
        missingBefore: target.missingBefore,
        verifiedMissingBefore: target.verifiedMissingBefore,
        uncheckedMissingBefore: target.uncheckedMissingBefore,
      })),
    }, null, 2))
    return
  }

  console.log(JSON.stringify({
    event: 'start',
    scraperDir,
    pipelineLogPath,
    fileConcurrency,
    experienceEnrichmentConcurrency,
    browserFallbackMode,
    maxJobsPerSource,
    targetSources: targets.length,
  }))

  const worker = async () => {
    while (cursor < targets.length) {
      const currentIndex = cursor
      cursor += 1
      const result = await processTarget(targets[currentIndex])
      results[currentIndex] = result

      completedSources += 1
      completedMissingBefore += result.missingBefore
      completedMissingAfter += result.missingAfter

      if (
        completedSources === 1
        || completedSources === targets.length
        || completedSources % progressEvery === 0
      ) {
        console.log(JSON.stringify({
          event: 'progress',
          completedSources,
          targetSources: targets.length,
          lastSource: result.source,
          lastMissingBefore: result.missingBefore,
          lastMissingAfter: result.missingAfter,
          selectedJobCount: result.selectedJobCount,
          recoveredSoFar: completedMissingBefore - completedMissingAfter,
          remainingSources: Math.max(0, targets.length - completedSources),
        }))
      }
    }
  }

  try {
    await Promise.all(
      Array.from({ length: Math.min(fileConcurrency, Math.max(1, targets.length)) }, () => worker()),
    )
  } finally {
    await closeSharedBrowserSession()
  }

  const summary = results.reduce((accumulator, result) => {
    accumulator.processedSources += 1
    accumulator.totalJobs += result.totalJobs
    accumulator.missingBefore += result.missingBefore
    accumulator.missingAfter += result.missingAfter
    return accumulator
  }, {
    processedSources: 0,
    totalJobs: 0,
    missingBefore: 0,
    missingAfter: 0,
  })

  console.log(JSON.stringify({
    event: 'summary',
    scraperDir,
    fileConcurrency,
    experienceEnrichmentConcurrency,
    browserFallbackMode,
    maxJobsPerSource,
    processedSources: summary.processedSources,
    totalJobs: summary.totalJobs,
    missingBefore: summary.missingBefore,
    missingAfter: summary.missingAfter,
    results: results.slice(0, 50),
  }, null, 2))
}

const directExecutionModulePath = resolveExecutionPath(fileURLToPath(import.meta.url))
const isEntrypoint = resolveExecutionPath(process.argv[1]) === directExecutionModulePath

if (isEntrypoint) {
  try {
    await main()
    process.exit(0)
  } catch (error) {
    console.error('Dry-run experience backfill failed:', error)
    process.exit(1)
  }
}
