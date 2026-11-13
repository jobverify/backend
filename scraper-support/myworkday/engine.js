/**
 * @file Reusable, configurable scraping engine for Workday career sites.
 * @module scraper/myworkday/engine
 */
import { setTimeout as sleep } from 'node:timers/promises'
import { workdayRequestScheduler } from './requestScheduler.js'
import { loadConfig } from '../utils/loadConfig.js'
import { normalizeCity } from '../utils/cityNormalizer.js'
import { extractJobDetail } from '../detailExtractors/index.js'
import { extractWorkdayJobDetail } from '../detailExtractors/workday.js'
import { toPlainText } from '../detailExtractors/shared.js'
import { parseRetryAfterHeader } from '../utils/fetch.js'
import { isGroupedLocationLabel } from '../../src/utils/jobLocations.js'
import { isJobInPublicLocationScope } from '../../src/utils/publicJobLocationScope.js'
import { extractWorkdayDetailLocations } from './locationDetails.js'
import { parseWorkdayNativeLifecycleDate } from './nativeLifecycleDates.js'
import { workdayListingIdentityDiagnostic } from './listingIdentityDiagnostics.js'
import { validateAureconWorksiteProof } from './nativeAureconWorksites.js'
import { attachInventoryEvidence } from '../utils/inventoryEvidence.js'
import {
  currentWorkdayBoardReceipt, explicitWorkdayCountryScope, explicitWorkdayAdditionalCountryScope, hasRecognizedWorkdayCountry, hashWorkdayProof,
  workdayInventoryIdentity, WORKDAY_COUNTRY_INVENTORY_PROOF,
} from './countryInventoryProof.js'
import {
  nativeDetailReceiptKey, readNativeDetailReceipt, rememberNativeDetailReceipt,
  NativeDetailRecoveryPendingError, NATIVE_DETAIL_SCOPE_PASS_MS, nativeDetailPassBudget, currentNativeDetailRecovery,
} from '../utils/nativeDetailRecovery.js'
import {
  currentWorkdayVanityHandoffReceipt, currentWorkdayVanityBoardReceipt,
  snapshotWorkdayVanityCaptureClocks, readBoundedWorkdayVanityHtml,
  currentWorkdayVanityRedirectReceipt, currentWorkdayVanityRedirectBoardReceipt,
  readBoundedWorkdayVanityChainHtml, readBoundedWorkdayVanityRedirect,
} from './officialVanityCareers.js'

const DEFAULT_COUNTRY_FACET_PARAMETER = 'locationCountry'
const DEFAULT_WORKDAY_DETAIL_FETCH_CONCURRENCY = 4
const DEFAULT_WORKDAY_DETAIL_ENRICHMENT_BUDGET_MS = 30 * 1000
const MAX_DEFAULT_WORKDAY_DETAIL_ENRICHMENT_BUDGET_MS = 120 * 1000
const DEFAULT_WORKDAY_REQUEST_TIMEOUT_MS = 20 * 1000
const DEFAULT_WORKDAY_RATE_LIMIT_RETRY_DELAY_MS = 5 * 1000
const WORKDAY_JOBS_API_PAGE_SIZE = 20
const WORKDAY_JOBS_API_RETRY_ATTEMPTS = 3
const WORKDAY_JOBS_API_RETRY_BASE_DELAY_MS = 1000
const WORKDAY_HOST_FAILURE_THRESHOLD = 2
const WORKDAY_HOST_CIRCUIT_COOLDOWN_MS = 5 * 60 * 1000
const WORKDAY_DETAIL_FALLBACK = Symbol.for('jobverify.workday.detail-fallback')
const WORKDAY_DETAIL_FALLBACK_REASON = Symbol.for('jobverify.workday.detail-fallback-reason')
const WORKDAY_CLOSING_INVENTORY_CHANGED = Symbol('workday-closing-inventory-changed')
const WORKDAY_COUNTRY_FACET_NORMALIZED = 'locationcountry'
const WORKDAY_FETCH_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36'
const WORKDAY_OUTAGE_TEXT_PATTERNS = [
  /workday is currently unavailable/i,
  /community\.workday\.com\/maintenance-page/i,
]

const WORKDAY_OUTAGE_URL_PATTERNS = [
  /community\.workday\.com\/maintenance-page/i,
  /\/wday\/drs\/outage\b/i,
]

const delay = async (ms, signal) => {
  try {
    await sleep(ms, undefined, { signal: signal || undefined })
  } catch (error) {
    throw signal?.aborted ? signal.reason : error
  }
}

const logRecoverableWorkdayNotice = (message) => {
  // PowerShell rewrites stderr from native commands into NativeCommandError blocks.
  console.log(message)
}

const createWorkdayEmptyResult = ({
  boardIdentityVerified,
  hasIndiaCountryFacet,
  pagesFetched,
  reportedTotal,
  surface,
}) => {
  const verified = boardIdentityVerified === true && hasIndiaCountryFacet === true
  return attachInventoryEvidence([], {
    status: verified ? 'verified-empty' : 'unverified',
    surface,
    firstParty: true,
    listingComplete: true,
    pagesFetched,
    reportedTotal,
    indiaFacetCount: 0,
    verifiedAt: new Date().toISOString(),
    reason: verified
      ? 'validated-workday-india-empty'
      : 'workday-board-identity-or-india-facet-unverified',
  })
}

const mapWithConcurrency = async (items, concurrency, mapper, errorController = null) => {
  const limit = Math.max(1, Number.parseInt(concurrency, 10) || 1)
  const results = new Array(items.length)
  let nextIndex = 0
  let firstError = null

  const worker = async () => {
    while (!firstError) {
      const currentIndex = nextIndex
      nextIndex += 1

      if (currentIndex >= items.length) return
      try {
        results[currentIndex] = await mapper(items[currentIndex], currentIndex)
      } catch (error) {
        if (!firstError) {
          firstError = error
          errorController?.abort(error)
        }
        return
      }
    }
  }

  // Cancellation stops active native peers; ownership is retained until every
  // worker's actual transport/response consumption has settled.
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  )

  if (firstError) throw firstError
  return results
}

export const resolveWorkdayDetailFetchConcurrency = (
  envValue = process.env.WORKDAY_DETAIL_FETCH_CONCURRENCY,
  configValue = null,
) => {
  const parsedEnvValue = Number.parseInt(envValue, 10)
  if (Number.isFinite(parsedEnvValue) && parsedEnvValue > 0) {
    return parsedEnvValue
  }

  const parsedConfigValue = Number.parseInt(configValue, 10)
  if (Number.isFinite(parsedConfigValue) && parsedConfigValue > 0) {
    return parsedConfigValue
  }

  return DEFAULT_WORKDAY_DETAIL_FETCH_CONCURRENCY
}

export class WorkdayUpstreamOutageError extends Error {
  constructor(message, options = {}) {
    super(message, options)
    this.name = 'WorkdayUpstreamOutageError'
    this.softFailure = true
    this.upstreamOutage = true
    this.abortRetries = true
    this.failureKind = 'network_or_timeout'
  }
}

export class WorkdayRequestTimeoutError extends Error {
  constructor(source, url, timeoutMs) {
    super(`[${source}] Workday request timed out after ${timeoutMs}ms at ${url}`)
    this.name = 'WorkdayRequestTimeoutError'
    this.softFailure = true
    this.upstreamOutage = true
    this.abortRetries = true
    this.failureKind = 'network_or_timeout'
    this.requestTimeoutMs = timeoutMs
  }
}

export class WorkdayHostCircuitOpenError extends Error {
  constructor(source, url, retryAt) {
    super(`[${source}] Workday host circuit is open for ${new URL(url).origin} until ${new Date(retryAt).toISOString()}`)
    this.name = 'WorkdayHostCircuitOpenError'
    this.softFailure = true
    this.upstreamOutage = true
    this.abortRetries = true
    this.failureKind = 'workday_host_circuit_open'
    this.retryAt = new Date(retryAt)
  }
}

const getWorkdayHostKey = (url) => new URL(url).origin

const isTransientWorkdayError = (error) => {
  if (
    error instanceof WorkdayRequestTimeoutError
    || error instanceof WorkdayUpstreamOutageError
  ) {
    return true
  }

  const status = Number(error?.jobsApiHttpStatus ?? error?.httpStatus)
  if (status === 429 || (status >= 500 && status <= 599)) return true

  const code = error?.cause?.code || error?.code
  return error instanceof TypeError
    || ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT'].includes(code)
}

export class WorkdayHostCircuitBreaker {
  constructor({
    failureThreshold = WORKDAY_HOST_FAILURE_THRESHOLD,
    cooldownMs = WORKDAY_HOST_CIRCUIT_COOLDOWN_MS,
    now = () => Date.now(),
  } = {}) {
    this.failureThreshold = Math.max(1, Number.parseInt(failureThreshold, 10) || 1)
    this.cooldownMs = Math.max(0, Number.parseInt(cooldownMs, 10) || 0)
    this.now = now
    this.hosts = new Map()
  }

  assertRequestAllowed(url, source = 'workday') {
    const key = getWorkdayHostKey(url)
    const state = this.hosts.get(key)
    if (!state?.openUntil) return

    if (state.openUntil <= this.now()) {
      this.hosts.delete(key)
      return
    }

    throw new WorkdayHostCircuitOpenError(source, url, state.openUntil)
  }

  recordFailure(url, error) {
    if (!isTransientWorkdayError(error) || error?.localTimeout === true) return

    const key = getWorkdayHostKey(url)
    const current = this.hosts.get(key) || { failures: 0, openUntil: null }
    const failures = current.failures + 1
    this.hosts.set(key, {
      failures,
      openUntil: failures >= this.failureThreshold
        ? this.now() + this.cooldownMs
        : null,
    })
  }

  recordSuccess(url) {
    this.hosts.delete(getWorkdayHostKey(url))
  }
}

const workdayHostCircuitBreaker = new WorkdayHostCircuitBreaker()

const throwIfAborted = (signal) => {
  if (!signal?.aborted) return
  throw signal.reason
}

const markWorkdayTransportFailure = (error) => {
  if (!isTransientWorkdayError(error)) return error

  error.softFailure = true
  error.upstreamOutage = true
  error.abortRetries = true
  error.failureKind = error.failureKind || 'network_or_timeout'
  return error
}

const markWorkdayTerminalFailure = (error) => {
  if (error && typeof error === 'object') {
    error.abortRetries = true
  }
  return error
}

const fetchWorkdayResource = async (
  url,
  options = {},
  {
    signal = null,
    timeoutMs = DEFAULT_WORKDAY_REQUEST_TIMEOUT_MS,
    source = 'workday',
    requestScheduler = workdayRequestScheduler,
    kind = 'listing',
  } = {},
  consumeResponse = async (response) => response,
) => {
  throwIfAborted(signal)

  const release = await requestScheduler.acquire(url, { signal, kind })
  const controller = new AbortController()
  if (signal?.aborted) controller.abort(signal.reason)
  const forwardAbort = () => controller.abort(signal.reason)
  let timeoutId

  if (signal) {
    signal.addEventListener('abort', forwardAbort, { once: true })
  }
  if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      controller.abort(new WorkdayRequestTimeoutError(source, url, timeoutMs))
    }, timeoutMs)
  }

  let response
  try {
    throwIfAborted(controller.signal)
    response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    throwIfAborted(controller.signal)
    if (response.status === 429) {
      requestScheduler.recordRateLimit(url,
        parseRetryAfterHeader(response.headers?.get?.('retry-after'))
          ?? DEFAULT_WORKDAY_RATE_LIMIT_RETRY_DELAY_MS)
    }
    const result = await consumeResponse(response)
    throwIfAborted(controller.signal)
    return result
  } catch (error) {
    if (controller.signal.aborted) {
      // Disposal remains owned by this request; never release its slot early.
      try { await response?.body?.cancel?.() } catch {}
      throw controller.signal.reason
    }
    throw markWorkdayTransportFailure(error)
  } finally {
    release()
    clearTimeout(timeoutId)
    if (signal) {
      signal.removeEventListener('abort', forwardAbort)
    }
  }
}

export const hasWorkdayOutageSignal = ({
  title = '',
  html = '',
  url = '',
  responseUrls = [],
} = {}) => {
  const textHaystack = [title, html]
    .filter((value) => typeof value === 'string' && value.trim())
    .join(' ')
  const urlHaystack = [url, ...responseUrls]
    .filter((value) => typeof value === 'string' && value.trim())
    .join(' ')

  return WORKDAY_OUTAGE_TEXT_PATTERNS.some((pattern) => pattern.test(textHaystack))
    || WORKDAY_OUTAGE_URL_PATTERNS.some((pattern) => pattern.test(urlHaystack))
}

const extractHtmlTitle = (html) => html.match(/<title>([^<]+)<\/title>/i)?.[1] || ''

const buildWorkdayOutageError = (source, url, cause = null) => (
  new WorkdayUpstreamOutageError(
    `[${source}] Workday is currently unavailable upstream at ${url}`,
    cause ? { cause } : undefined,
  )
)

const applyWorkdayRetryDelayHint = (
  error,
  {
    httpStatus = Number(error?.jobsApiHttpStatus ?? error?.httpStatus),
    responseHeaders = null,
  } = {},
) => {
  if (httpStatus !== 429) return error

  const retryDelayMs = parseRetryAfterHeader(responseHeaders?.get?.('retry-after'))
    ?? DEFAULT_WORKDAY_RATE_LIMIT_RETRY_DELAY_MS
  error.retryDelayMs = retryDelayMs
  return error
}

const resolveWorkdayRetryDelayMs = (
  error,
  attempt,
  baseDelayMs = WORKDAY_JOBS_API_RETRY_BASE_DELAY_MS,
) => Math.max(
  baseDelayMs * (2 ** Math.max(0, attempt - 1)),
  Number(error?.retryDelayMs) || 0,
)

const parseWorkdayApiErrorPayload = (bodyText) => {
  try {
    const payload = JSON.parse(bodyText)
    const errorCode = typeof payload?.errorCode === 'string' ? payload.errorCode : ''
    const httpStatus = Number(payload?.httpStatus)

    if (/^HTTP_\d{3}$/i.test(errorCode)) {
      return { errorCode, httpStatus }
    }

    if (Number.isInteger(httpStatus) && httpStatus >= 400) {
      return { errorCode: `HTTP_${httpStatus}`, httpStatus }
    }
  } catch {
    return null
  }

  return null
}

const getWorkdayApiFailureStatus = (payload = {}) => {
  if (Number.isInteger(payload.httpStatus)) {
    return payload.httpStatus
  }

  const parsed = Number.parseInt(String(payload.errorCode || '').replace(/\D+/g, ''), 10)
  return Number.isFinite(parsed) ? parsed : null
}

const buildWorkdayApiFailureError = (source, url, payload, cause = null) => {
  const error = new Error(
    `[${source}] Workday jobs API returned ${payload.errorCode} at ${url}`,
    cause ? { cause } : undefined,
  )
  const httpStatus = getWorkdayApiFailureStatus(payload)

  error.name = 'WorkdayJobsApiError'
  error.workdayJobsApiFailure = true
  error.jobsApiErrorCode = payload.errorCode
  error.jobsApiHttpStatus = httpStatus

  if (httpStatus === 429 || (httpStatus >= 500 && httpStatus <= 599)) {
    error.softFailure = true
    error.upstreamOutage = true
    error.failureKind = 'network_or_timeout'
    applyWorkdayRetryDelayHint(error, { httpStatus })
  } else if (httpStatus >= 400 && httpStatus <= 499) {
    error.abortRetries = true
  }

  return error
}

const buildWorkdayHttpFailureError = (
  source,
  url,
  status,
  responseHeaders = null,
) => applyWorkdayRetryDelayHint(
  buildWorkdayApiFailureError(source, url, {
    errorCode: `HTTP_${status}`,
    httpStatus: status,
  }),
  {
    httpStatus: status,
    responseHeaders,
  },
)

const validateWorkdayJobsApiPayload = (payload, {
  source,
  url,
  offset,
}) => {
  const total = payload?.total
  const jobs = payload?.jobPostings
  const isValidShape = payload
    && typeof payload === 'object'
    && Number.isInteger(total)
    && total >= 0
    && Array.isArray(jobs)
  const hasImpossibleEmptyPage = isValidShape
    && jobs.length === 0
    && offset < total

  if (!isValidShape || hasImpossibleEmptyPage) {
    const error = new Error(
      `[${source}] Workday jobs API returned an invalid success payload at ${url}`,
    )
    error.name = 'WorkdayJobsApiContractError'
    error.abortRetries = true
    error.failureKind = 'parser_or_contract_error'
    throw error
  }

  return payload
}

const isWorkdayCountryFacetKey = (key) => (
  String(key).replace(/_/g, '').toLowerCase() === WORKDAY_COUNTRY_FACET_NORMALIZED
)

const isWorkdayLocationFacetKey = (key) => (
  String(key).replace(/_/g, '').toLowerCase().startsWith('location')
)

const hasWorkdayCountryFacetValues = (appliedFacets = {}) => (
  Object.entries(appliedFacets).some(([key, values]) => (
    isWorkdayCountryFacetKey(key)
    && Array.isArray(values)
    && values.length > 0
  ))
)

const hasWorkdayLocationFacetValues = (appliedFacets = {}) => (
  Object.entries(appliedFacets).some(([key, values]) => (
    isWorkdayLocationFacetKey(key)
    && Array.isArray(values)
    && values.length > 0
  ))
)

const removeWorkdayCountryFacets = (appliedFacets = {}) => Object.fromEntries(
  Object.entries(appliedFacets).filter(([key]) => (
    !isWorkdayCountryFacetKey(key)
  )),
)

const removeWorkdayLocationFacets = (appliedFacets = {}) => Object.fromEntries(
  Object.entries(appliedFacets).filter(([key]) => (
    !isWorkdayLocationFacetKey(key)
  )),
)

const shouldRetryWithoutWorkdayCountryFacet = ({
  error,
  retryAttempted,
  locationCountry,
  appliedFacets,
}) => {
  if (retryAttempted || !locationCountry) return false
  if (Number(error?.jobsApiHttpStatus) !== 400) return false

  return hasWorkdayCountryFacetValues(appliedFacets)
}

const shouldRetryWithoutWorkdayLocationFacets = ({
  error,
  retryAttempted,
  appliedFacets,
}) => {
  if (retryAttempted) return false
  if (Number(error?.jobsApiHttpStatus) !== 400) return false

  return hasWorkdayLocationFacetValues(appliedFacets)
}

const probeWorkdaySearchPageForOutage = async (
  searchUrl,
  {
    signal = null,
    requestTimeoutMs = DEFAULT_WORKDAY_REQUEST_TIMEOUT_MS,
    source = 'workday',
    requestScheduler = workdayRequestScheduler,
  } = {},
) => {
  try {
    const { response, html } = await fetchWorkdayResource(
      searchUrl,
      {},
      {
        signal,
        timeoutMs: requestTimeoutMs,
        source,
        requestScheduler,
      },
      async (response) => ({
        response,
        html: await response.text(),
      }),
    )

    return hasWorkdayOutageSignal({
      title: extractHtmlTitle(html),
      html,
      url: response.url,
    })
  } catch (error) {
    throwIfAborted(signal)
    if (error instanceof WorkdayRequestTimeoutError) throw error
    return false
  }
}

export const buildWorkdaySearchUrl = (baseUrl, locationCountry) => {
  const url = new URL(baseUrl)
  const hasCountryFilter = Array.from(url.searchParams.keys()).some(isWorkdayCountryFacetKey)

  if (!hasCountryFilter && locationCountry != null && locationCountry !== '') {
    url.searchParams.set('locationCountry', locationCountry)
  }

  return url.toString()
}

export const buildWorkdayAppliedFacets = (
  baseUrl,
  locationCountry,
  countryFacetParameter = DEFAULT_COUNTRY_FACET_PARAMETER,
) => {
  const url = new URL(baseUrl)
  const appliedFacets = {}
  let hasCountryFacet = false

  for (const [key, value] of url.searchParams.entries()) {
    if (!value) continue

    if (isWorkdayCountryFacetKey(key)) {
      hasCountryFacet = true
    }

    appliedFacets[key] = [...(appliedFacets[key] || []), value]
  }

  if (!hasCountryFacet && locationCountry) {
    appliedFacets[countryFacetParameter] = [locationCountry]
  }

  return appliedFacets
}

const normalizeWorkdaySummaryText = (value) => {
  if (typeof value !== 'string') return null
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized || null
}

const isLikelyWorkdayRequisitionToken = (value) => {
  const normalized = normalizeWorkdaySummaryText(value)
  if (!normalized) return false
  if (/[,\s]/.test(normalized)) return false

  return /^(?:[A-Z]{1,6}[A-Z0-9_-]*\d[A-Z0-9_-]*|\d{5,})$/i.test(normalized)
}

const extractWorkdayLocationFromBulletFields = (bulletFields = []) => {
  if (!Array.isArray(bulletFields)) return null

  return bulletFields
    .map(normalizeWorkdaySummaryText)
    .find((value) => value && !isLikelyWorkdayRequisitionToken(value))
    || null
}

const extractWorkdayLocationFromExternalPath = (externalPath) => {
  if (!externalPath) return null

  try {
    const pathname = new URL(externalPath, 'https://example.com').pathname
    const pathParts = pathname.split('/').filter(Boolean)
    const jobIndex = pathParts.findIndex((part) => part.toLowerCase() === 'job')
    const candidate = pathParts[jobIndex + 1]
    if (!candidate) return null

    return normalizeWorkdaySummaryText(
      decodeURIComponent(candidate)
        .replace(/---/g, ' - ')
        .replace(/[_+]/g, ' ')
        .replace(/-/g, ' '),
    )
  } catch {
    return null
  }
}

const resolveWorkdaySummaryLocation = (job = {}) => (
  normalizeWorkdaySummaryText(job.locationsText)
  || extractWorkdayLocationFromBulletFields(job.bulletFields)
  || extractWorkdayLocationFromExternalPath(job.externalPath)
  || 'Unknown'
)

// Returns the start of "today" in IST as a UTC-midnight Date.
const startOfTodayIST = () => {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
  const nowIST = new Date(Date.now() + IST_OFFSET_MS)
  return new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate()))
}

// Parses a date string and returns UTC midnight of that calendar date.
const toUTCMidnight = (dateStr) => {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}

// Parses relative/absolute "Posted On" strings into Date objects.
const parsePostedOn = (raw) => {
  if (!raw) return null
  const text = raw.trim().toLowerCase()
  const today = startOfTodayIST()
  const daysAgo = (n) => {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() - n)
    return d
  }
  if (/\btoday\b/.test(text)) return daysAgo(0)
  if (/\byesterday\b/.test(text)) return daysAgo(1)
  const relativeMatch = text.match(/(\d+)\s+days?\s+ago/)
  if (relativeMatch) return daysAgo(parseInt(relativeMatch[1], 10))
  if (/\d+\s*\+/.test(text)) return null
  const cleaned = raw.replace(/^posted\s+/i, '').trim()
  return toUTCMidnight(cleaned)
}

const resolveWorkdayPostingDate = (detailPostingDate, listingPostedOn) => {
  const raw = detailPostingDate || listingPostedOn
  if (!raw) return { raw: null, date: null, precision: null, exact: false }
  try {
    return parseWorkdayNativeLifecycleDate(raw)
  } catch {
    // Only native CXS fields are mandatory strict dates. Existing page/listing
    // labels can express relative days or a lower bound instead of a clock.
    return { raw: null, date: parsePostedOn(raw), exact: false,
      precision: /\d+\s*\+/.test(raw) ? 'relative-lower-bound' : 'relative-day' }
  }
}

// Parses absolute closing date strings into Date objects.
const parseClosingDate = (raw) => {
  if (!raw) return null
  const text = raw.trim().toLowerCase()
  if (/no\s+end\s+date|no\s+closing|open/i.test(text)) return null
  const cleaned = raw.replace(/^(ends?|closes?|end\s+date[:\s]*)\s*/i, '').trim()
  return toUTCMidnight(cleaned)
}

// Extracts clean city name or remote keywords from locations.
export const extractCity = (location) => {
  if (!location || location === 'Unknown') return null;
  const loc = location.trim();
  let cityCandidate;
  if (/remote/i.test(loc) || /^virtual\b/i.test(loc)) {
    cityCandidate = 'Remote';
  } else {
    const areaMatch = loc.match(/^(.+?)\s+Area\b/i);
    if (areaMatch) {
      cityCandidate = areaMatch[1].trim();
    } else {
      const normalizedWholeLocation = normalizeCity(loc);
      if (
        normalizedWholeLocation
        && !/^india$/i.test(normalizedWholeLocation)
        && normalizedWholeLocation !== loc
      ) {
        return normalizedWholeLocation;
      }

      const commaParts = loc.split(',');
      if (commaParts.length > 1) {
        cityCandidate = /^india$/i.test(commaParts[0].trim())
          ? commaParts[1].trim()
          : commaParts[0].trim();
      } else {
        cityCandidate = loc.replace(/\s*India\s*$/i, '').trim() || loc;
      }
    }
  }
  return normalizeCity(cityCandidate);
};

export const matchesWorkdayLocationPattern = (
  { location, locations = [] } = {},
  locationPattern,
) => {
  if (!locationPattern) return true

  const regex = new RegExp(locationPattern, 'i')
  return [location, ...locations]
    .filter((value) => typeof value === 'string' && value.trim())
    .some((value) => regex.test(value))
}

const hasExplicitIndiaMarker = (value = '') => (
  /\bindia\b/i.test(String(value || '').trim())
)

const extractLeadingCountryCode = (value = '') =>
  String(value || '').trim().match(/^([A-Z]{2,3})\s*[-,.]\s*/i)?.[1]?.toUpperCase() || null

// Keep summary-location filtering conservative: skip detail only when the
// listing is already clearly outside the public India scope.
const isClearlyOutsidePublicIndiaScope = (
  { location, locations = [] } = {},
) => {
  const summaryValues = [location, ...locations]
    .filter((value) => typeof value === 'string' && value.trim())
  const hasIndiaMarker = summaryValues.some((value) => hasExplicitIndiaMarker(value))
  const hasIndiaCountryCodePrefix = summaryValues.some((value) => ['IN', 'IND'].includes(extractLeadingCountryCode(value)))
  const hasNonIndiaCountryCodePrefix = summaryValues.some((value) => {
    const countryCode = extractLeadingCountryCode(value)
    return countryCode && !['IN', 'IND'].includes(countryCode)
  })

  if (summaryValues.length === 0) return false
  if (hasIndiaMarker) return false
  if (hasIndiaCountryCodePrefix) return false
  if (hasNonIndiaCountryCodePrefix) return true
  if (summaryValues.some((value) => /remote/i.test(String(value)) && String(value).includes(','))) {
    return true
  }

  const extractedCity = extractCity(location)
  const summaryCity = extractedCity === 'Remote' ? null : extractedCity

  if (isJobInPublicLocationScope({
    location,
    locations,
    city: summaryCity,
  })) {
    return false
  }

  return summaryValues.some((value) => {
    const summary = String(value).trim()
    // Employer office labels can identify a country without a leading code.
    if (/\b(?:USA|United States(?: of America)?)\b/i.test(summary)) return true
    if (/remote/i.test(summary)) return true
    if (summary.includes(',')) return true
    if (/\barea\b/i.test(summary)) return true
    return false
  })
}

export const shouldFetchWorkdayJobDetail = (
  { location, locations = [] } = {},
  locationPattern,
) => {
  if (!location || location === 'Unknown') return true
  if (isGroupedLocationLabel(location)) return true

  if (locationPattern) {
    return matchesWorkdayLocationPattern({ location, locations }, locationPattern)
  }

  return !isClearlyOutsidePublicIndiaScope({ location, locations })
}

// Extracts alpha-numeric job IDs from detail hyperlinks.
const extractJobId = (link) => {
  const match = link.match(/_([A-Z]{1,5}\d+)(?:\?|$)/)
  return match ? match[1] : null
}

const getSafeWorkdayUrl = (value, baseUrl) => {
  try {
    const base = new URL(baseUrl)
    const url = new URL(value, baseUrl)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    return url.hostname === base.hostname ? url.href.split('?')[0] : null
  } catch {
    return null
  }
}

// Workday's native external URL can omit the listing's leading locale. Only
// that segment is optional. Workday also canonicalizes the board's casing;
// the exact origin and remaining role path must still bind the response.
const matchesWorkdayNativeRoleUrl = (value, canonicalLink) => {
  if (typeof value !== 'string') return false
  try {
    const native = new URL(value), listing = new URL(canonicalLink)
    if (native.protocol !== 'https:' || listing.protocol !== 'https:'
      || native.origin !== listing.origin || native.username || native.password
      || native.search || native.hash || listing.search || listing.hash) return false
    const rolePath = url => url.pathname.replace(/^\/[a-z]{2}-[a-z]{2}(?=\/)/i, '')
      .replace(/^\/([^/]+)(?=\/job\/)/, (_match, board) => '/' + board.toLowerCase())
    return rolePath(native) === rolePath(listing)
  } catch { return false }
}

const emptyDetailPayload = () => ({
  locations: [],
  jobDescription: null,
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: [],
  experienceRequired: null,
  postingDate: null,
  department: null,
  requisitionId: null,
})

const createFallbackDetailPayload = (reason = null) => {
  const payload = emptyDetailPayload()
  Object.defineProperty(payload, WORKDAY_DETAIL_FALLBACK, {
    value: true,
  })
  if (reason) {
    Object.defineProperty(payload, WORKDAY_DETAIL_FALLBACK_REASON, {
      value: reason,
    })
  }
  return payload
}

const isUsingFallbackDetailPayload = (payload) => payload?.[WORKDAY_DETAIL_FALLBACK] === true

const getWorkdayDetailFallbackReason = (payload) => (
  payload?.[WORKDAY_DETAIL_FALLBACK_REASON] || null
)

const shouldDisableWorkdayDetailEnrichmentAfterFallback = (detailPayload) => {
  const reason = getWorkdayDetailFallbackReason(detailPayload)
  if (!reason) return false

  const status = Number(reason?.jobsApiHttpStatus ?? reason?.httpStatus)
  return reason instanceof WorkdayRequestTimeoutError
    || reason instanceof WorkdayHostCircuitOpenError
    || status === 403
    || status === 429
}

const maybeDisableWorkdayDetailEnrichment = (detailPayload, detailEnrichmentState, source) => {
  if (
    !isUsingFallbackDetailPayload(detailPayload)
    || detailEnrichmentState.disabled
    || !shouldDisableWorkdayDetailEnrichmentAfterFallback(detailPayload)
  ) {
    return
  }

  detailEnrichmentState.disabled = true
  detailEnrichmentState.failureReason = getWorkdayDetailFallbackReason(detailPayload)
  if (!detailEnrichmentState.noticeLogged) {
    detailEnrichmentState.noticeLogged = true
    logRecoverableWorkdayNotice(`  [${source}] Workday detail requests became unstable; continuing with listing-backed data for the remaining jobs on this source.`)
  }
}

const shouldFallbackToListingDataAfterDetailFailure = (error) => {
  const status = Number(error?.jobsApiHttpStatus ?? error?.httpStatus)
  return error instanceof WorkdayRequestTimeoutError
    || error?.upstreamOutage === true
    || isTransientWorkdayError(error)
    || status === 403
}

const resolveWorkdayLocationsFromSummary = (location, detailPayload) => {
  if (detailPayload?.locations?.length > 0) return detailPayload.locations

  const summaryCity = extractCity(location)
  return summaryCity ? [summaryCity] : []
}

const shouldPublishWorkdayListingFallback = ({ location, detailPayload, locations }) => {
  if (!isUsingFallbackDetailPayload(detailPayload)) return true

  const summaryCity = extractCity(location)
  return isWorkdayJobInPublicIndiaScope({
    location,
    locations,
    city: summaryCity === 'Remote' ? null : summaryCity,
  })
}

const isWorkdayJobInPublicIndiaScope = ({ location, locations = [], city = null } = {}) => {
  const locationValues = [location, ...locations]
    .filter((value) => typeof value === 'string' && value.trim())
  if (locationValues.some((value) => hasExplicitIndiaMarker(value)
    || ['IN', 'IND'].includes(extractLeadingCountryCode(value)))) {
    return true
  }
  return isJobInPublicLocationScope({
    location,
    locations,
    city: city === 'Remote' ? null : city,
  })
}

const buildWorkdayJobDetailUrl = (externalPath, detailUrlBase, baseUrl) => {
  if (!externalPath) return null

  const safeBase = detailUrlBase ? detailUrlBase.replace(/\/$/, '') : null
  const candidate = safeBase && externalPath.startsWith('/')
    ? `${safeBase}${externalPath}`
    : new URL(externalPath, detailUrlBase || baseUrl).href

  return getSafeWorkdayUrl(candidate, baseUrl)
}

const isRetryableWorkdayJobsApiError = (error) => {
  const status = Number(error?.jobsApiHttpStatus)
  return status === 429 || (status >= 500 && status <= 599)
}

const shouldCountWorkdayHostCircuitFailure = (error) => {
  const status = Number(error?.jobsApiHttpStatus ?? error?.httpStatus)
  if (status === 429) return false
  return isTransientWorkdayError(error)
}

const didWorkdayHostCircuitOpen = (circuitBreaker, url, source) => {
  try {
    circuitBreaker.assertRequestAllowed(url, source)
    return false
  } catch (error) {
    if (error?.name === 'WorkdayHostCircuitOpenError') {
      return true
    }
    throw error
  }
}

const getSetCookieHeaders = (headers) => {
  if (!headers) return []
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie()
  }

  const singleCookie = headers.get?.('set-cookie')
  return singleCookie ? [singleCookie] : []
}

const buildCookieHeader = (setCookies = []) => (
  setCookies
    .map((value) => String(value).split(';')[0]?.trim())
    .filter(Boolean)
    .join('; ')
)

const extractCookieValue = (setCookies = [], cookieName) => (
  setCookies
    .map((value) => value.match(new RegExp(`^${cookieName}=([^;]+)`))?.[1])
    .find(Boolean)
    || null
)

const workdayJobsApiSessionFromResponse = ({ response, html, bootstrapUrl, jobsApiUrl, source }) => {
  if (!response.ok) {
    if (hasWorkdayOutageSignal({ title: extractHtmlTitle(html), html, url: response.url })) {
      throw buildWorkdayOutageError(source, bootstrapUrl)
    }
    throw buildWorkdayHttpFailureError(source, bootstrapUrl, response.status, response.headers)
  }
  if (hasWorkdayOutageSignal({ title: extractHtmlTitle(html), html, url: response.url })) {
    throw buildWorkdayOutageError(source, bootstrapUrl)
  }
  const setCookies = getSetCookieHeaders(response.headers)
  return {
    bootstrapUrl,
    origin: new URL(jobsApiUrl).origin,
    cookieHeader: buildCookieHeader(setCookies),
    csrfToken: extractCookieValue(setCookies, 'CALYPSO_CSRF_TOKEN'),
  }
}

const bootstrapWorkdayJobsApiSession = async ({
  bootstrapUrl,
  jobsApiUrl,
  source = 'workday',
  signal = null,
  requestTimeoutMs = DEFAULT_WORKDAY_REQUEST_TIMEOUT_MS,
  retryBaseDelayMs = WORKDAY_JOBS_API_RETRY_BASE_DELAY_MS,
  circuitBreaker = workdayHostCircuitBreaker,
  requestScheduler = workdayRequestScheduler,
}) => {
  if (!bootstrapUrl) return null

  let lastError = null

  for (let attempt = 1; attempt <= WORKDAY_JOBS_API_RETRY_ATTEMPTS; attempt += 1) {
    throwIfAborted(signal)
    circuitBreaker.assertRequestAllowed(jobsApiUrl, source)

    try {
      const { response, html } = await fetchWorkdayResource(
        bootstrapUrl,
        {
          headers: {
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'accept-language': 'en-US',
            'user-agent': WORKDAY_FETCH_USER_AGENT,
          },
        },
        {
          signal,
          timeoutMs: requestTimeoutMs,
          source,
          requestScheduler,
        },
        async (response) => ({
          response,
          html: await response.text(),
        }),
      )

      return workdayJobsApiSessionFromResponse({ response, html, bootstrapUrl, jobsApiUrl, source })
    } catch (error) {
      throwIfAborted(signal)
      lastError = error
      const retryableError = isRetryableWorkdayJobsApiError(error)
      const countTowardHostCircuit = shouldCountWorkdayHostCircuitFailure(error)

      if (retryableError && countTowardHostCircuit) {
        circuitBreaker.recordFailure(jobsApiUrl, error)
        if (didWorkdayHostCircuitOpen(circuitBreaker, jobsApiUrl, source)) {
          throw markWorkdayTransportFailure(error)
        }
      }

      if (
        error?.abortRetries === true
        || attempt >= WORKDAY_JOBS_API_RETRY_ATTEMPTS
        || !retryableError
      ) {
        if (!retryableError && countTowardHostCircuit) {
          circuitBreaker.recordFailure(jobsApiUrl, error)
        }
        throw markWorkdayTransportFailure(error)
      }

      await delay(resolveWorkdayRetryDelayMs(error, attempt, retryBaseDelayMs), signal)
    }
  }

  throw lastError
}

export const fetchWorkdayJobsApiPage = async ({
  jobsApiUrl,
  bootstrapUrl = null,
  appliedFacets,
  offset,
  limit = WORKDAY_JOBS_API_PAGE_SIZE,
  searchText = '',
  source = 'workday',
  session = null,
  signal = null,
  requestTimeoutMs = DEFAULT_WORKDAY_REQUEST_TIMEOUT_MS,
  retryBaseDelayMs = WORKDAY_JOBS_API_RETRY_BASE_DELAY_MS,
  circuitBreaker = workdayHostCircuitBreaker,
  requestScheduler = workdayRequestScheduler,
  requireProofResponse = false,
}) => {
  throwIfAborted(signal)
  let lastError = null
  const workdaySession = session || await bootstrapWorkdayJobsApiSession({
    bootstrapUrl,
    jobsApiUrl,
    source,
    signal,
    requestTimeoutMs,
    retryBaseDelayMs,
    circuitBreaker,
    requestScheduler,
  })

  for (let attempt = 1; attempt <= WORKDAY_JOBS_API_RETRY_ATTEMPTS; attempt += 1) {
    try {
      throwIfAborted(signal)
      circuitBreaker.assertRequestAllowed(jobsApiUrl, source)

      const {
        response,
        contentType,
        bodyText = '',
        payload = null,
      } = await fetchWorkdayResource(
        jobsApiUrl,
        {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'accept-language': 'en-US',
            'content-type': 'application/json',
            'user-agent': WORKDAY_FETCH_USER_AGENT,
            ...(workdaySession?.origin ? { origin: workdaySession.origin } : {}),
            ...(workdaySession?.bootstrapUrl ? { referer: workdaySession.bootstrapUrl } : {}),
            ...(workdaySession?.csrfToken
              ? { 'x-calypso-csrf-token': workdaySession.csrfToken }
              : {}),
            ...(workdaySession?.cookieHeader ? { cookie: workdaySession.cookieHeader } : {}),
          },
          body: JSON.stringify({
            appliedFacets,
            limit,
            offset,
            searchText,
          }),
        },
        {
          signal,
          timeoutMs: requestTimeoutMs,
          source,
          requestScheduler,
        },
        async (response) => {
          const contentType = response.headers?.get?.('content-type') || ''
          if (requireProofResponse && response.ok && (response.url !== jobsApiUrl
            || !/^application\/(?:[\w.-]+\+)?json(?:\s*;|$)/i.test(contentType))) {
            throw buildWorkdayIncompleteListingError(source, 'complete-board response URL or JSON content type is invalid')
          }
          if (!response.ok || /text\/html/i.test(contentType)) {
            return {
              response,
              contentType,
              bodyText: await response.text(),
            }
          }

          return {
            response,
            contentType,
            payload: await response.json(),
          }
        },
      )

      if (!response.ok) {
        const workdayApiFailure = /json/i.test(contentType)
          ? parseWorkdayApiErrorPayload(bodyText)
          : null

        if (workdayApiFailure) {
          throw applyWorkdayRetryDelayHint(
            buildWorkdayApiFailureError(source, jobsApiUrl, workdayApiFailure),
            {
              httpStatus: getWorkdayApiFailureStatus(workdayApiFailure),
              responseHeaders: response.headers,
            },
          )
        }

        if (hasWorkdayOutageSignal({
          title: extractHtmlTitle(bodyText),
          html: bodyText,
          url: response.url,
        })) {
          throw buildWorkdayOutageError(source, jobsApiUrl)
        }

        throw buildWorkdayHttpFailureError(
          source,
          jobsApiUrl,
          response.status,
          response.headers,
        )
      }

      if (/text\/html/i.test(contentType)) {
        if (hasWorkdayOutageSignal({
          title: extractHtmlTitle(bodyText),
          html: bodyText,
          url: response.url,
        })) {
          throw buildWorkdayOutageError(source, jobsApiUrl)
        }

        throw new Error(`[${source}] Expected JSON from ${jobsApiUrl} but received HTML`)
      }

      const validatedPayload = validateWorkdayJobsApiPayload(payload, {
        source,
        url: jobsApiUrl,
        offset,
      })
      circuitBreaker.recordSuccess(jobsApiUrl)
      return validatedPayload
    } catch (error) {
      throwIfAborted(signal)
      lastError = error
      const retryableError = isRetryableWorkdayJobsApiError(error)
      const countTowardHostCircuit = shouldCountWorkdayHostCircuitFailure(error)

      if (retryableError && countTowardHostCircuit) {
        circuitBreaker.recordFailure(jobsApiUrl, error)
        if (didWorkdayHostCircuitOpen(circuitBreaker, jobsApiUrl, source)) {
          throw markWorkdayTransportFailure(error)
        }
      }

      if (
        error?.abortRetries === true
        ||
        attempt >= WORKDAY_JOBS_API_RETRY_ATTEMPTS
        || !retryableError
      ) {
        if (!retryableError && countTowardHostCircuit) {
          circuitBreaker.recordFailure(jobsApiUrl, error)
        }
        throw markWorkdayTransportFailure(error)
      }

      await delay(resolveWorkdayRetryDelayMs(error, attempt, retryBaseDelayMs), signal)
      throwIfAborted(signal)
    }
  }

  throw lastError
}

export const shouldContinueWorkdayJobsApiPagination = ({
  jobsCount,
  offsetAfterPage,
  payloadTotal,
  pageSize = WORKDAY_JOBS_API_PAGE_SIZE,
}) => {
  if (payloadTotal > 0) return offsetAfterPage < payloadTotal
  return jobsCount >= pageSize
}

const extractDetailedJobPayload = async (page, jobUrl, config, source) => {
  try {
    await page.goto(jobUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('body', {
      timeout: config.jobListingTimeoutMs,
    }).catch(() => null)
    await new Promise((resolve) => setTimeout(resolve, config.pageLoadDelayMs || 1000))
    const html = await page.content()
    return {
      locations: extractWorkdayDetailLocations(html),
      ...(await extractJobDetail({ provider: 'workday', html })),
    }
  } catch (error) {
    logRecoverableWorkdayNotice(`  [${source}] Failed to enrich details for ${jobUrl}: ${error.message}`)
    const detailPayload = emptyDetailPayload()
    Object.defineProperty(detailPayload, WORKDAY_DETAIL_FALLBACK_REASON, { value: error })
    return detailPayload
  }
}

export const inferWorkdayJobsApiConfig = (baseUrl) => {
  let url
  try {
    url = new URL(baseUrl)
  } catch {
    return null
  }

  const pathParts = url.pathname.split('/').filter(Boolean)
  const apiMarkerIndex = pathParts.findIndex((part, index) => (
    part === 'wday' && pathParts[index + 1] === 'cxs'
  ))

  if (apiMarkerIndex >= 0) {
    const tenant = pathParts[apiMarkerIndex + 2]
    const site = pathParts[apiMarkerIndex + 3]
    if (!tenant || !site || pathParts[apiMarkerIndex + 4] !== 'jobs') return null

    return {
      jobsApiUrl: `${url.origin}/wday/cxs/${tenant}/${site}/jobs`,
      detailUrlBase: `${url.origin}/${site}`,
    }
  }

  let tenant
  let site
  if (/\.myworkdayjobs\.com$/i.test(url.hostname)) {
    tenant = url.hostname.split('.')[0]
    site = pathParts.filter((part) => !/^[a-z]{2}-[a-z]{2}$/i.test(part)).at(-1)
  } else if (/\.myworkdaysite\.com$/i.test(url.hostname)) {
    const recruitingIndex = pathParts.findIndex((part) => part.toLowerCase() === 'recruiting')
    tenant = recruitingIndex >= 0 ? pathParts[recruitingIndex + 1] : null
    site = recruitingIndex >= 0 ? pathParts[recruitingIndex + 2] : null
  }

  if (!tenant || !site) return null

  const detailUrl = new URL(url)
  detailUrl.search = ''
  detailUrl.hash = ''
  return {
    jobsApiUrl: `${url.origin}/wday/cxs/${tenant}/${site}/jobs`,
    detailUrlBase: detailUrl.toString().replace(/\/$/, ''),
  }
}

export const buildWorkdayDetailApiUrl = (jobUrl, jobsApiUrl) => {
  try {
    const job = new URL(jobUrl), api = new URL(jobsApiUrl)
    const jobPath = job.pathname.match(/\/job\/.+$/)?.[0]
    if (job.origin !== api.origin || !/^https:$/.test(api.protocol)
      || !/\/wday\/cxs\/[^/]+\/[^/]+\/jobs$/.test(api.pathname) || !jobPath) return null
    api.pathname = api.pathname.replace(/\/jobs$/, '') + jobPath
    api.search = ''; api.hash = ''
    return api.href
  } catch { return null }
}

const extractWorkdayNativeDateMetadata = posting => {
  const startDate = parseWorkdayNativeLifecycleDate(posting?.startDate, { field: 'startDate' })
  const endDate = parseWorkdayNativeLifecycleDate(posting?.endDate, { field: 'endDate' })
  if (!startDate.date && !endDate.date) return {}
  return {
    ...(startDate.raw && { postingDate: startDate.raw }),
    closingDate: endDate.raw,
    sourceDateProvenance: 'workday-cxs-jobPostingInfo',
    sourceRawDates: { startDate: startDate.raw, endDate: endDate.raw },
    postingDatePrecision: startDate.precision, closingDatePrecision: endDate.precision,
    sourcePostingDateIsExact: startDate.exact, sourceClosingDateIsExact: endDate.exact,
  }
}

export const extractWorkdayStructuredDetail = payload => {
  const posting = payload?.jobPostingInfo
  const nativeDates = extractWorkdayNativeDateMetadata(posting)
  if (typeof posting?.jobDescription !== 'string') return null
  const sourceDescription = toPlainText(posting.jobDescription)
  if (!sourceDescription) return null
  const detail = extractWorkdayJobDetail(`<section data-automation-id="jobPostingDescription"><div>${posting.jobDescription}</div></section>`)
  const locationRecords = [resolveWorkdayCxsPrimaryLocation(posting), ...(Array.isArray(posting.additionalLocations) ? posting.additionalLocations : [])]
    .map((value, index) => ({
      label: typeof value === 'string' ? value.trim() : value?.descriptor?.trim(),
      countryScope: resolveWorkdayCxsPrimaryCountryScope(index === 0
        ? { ...posting, country: value?.country || posting.country }
        : { country: value?.country || (value === resolveWorkdayRequisitionLocationBinding(posting)?.publicLocation
          ? posting.jobRequisitionLocation.country : null) }),
    }))
    .filter(({ label }) => label && !isGroupedLocationLabel(label))
  const locations = [...new Set(locationRecords.map(({ label }) => label))]
  // A generic Remote label must not override the API's authoritative country.
  // Keep India secondary addresses even when the primary country is foreign.
  const hasCountryScope = locationRecords.some(({ countryScope }) => countryScope)
  const indiaScopeLocations = hasCountryScope ? [...new Set(locationRecords.flatMap(({ label, countryScope }) => {
    if (countryScope === 'foreign') return []
    if (countryScope === 'india') return [hasExplicitIndiaMarker(label) ? label : `${label}, India`]
    return !/^remote$/i.test(label) && isWorkdayJobInPublicIndiaScope({ location: label }) ? [label] : []
  }))] : null
  return { ...detail, sourceDescription, jobDescription: sourceDescription,
    locations, indiaScopeLocations, requisitionId: posting.jobReqId || detail.requisitionId,
    ...nativeDates,
    publicExperienceChecked: true }
}

const fetchDetailedJobPayload = async (
  jobUrl,
  source,
  session = null,
  {
    signal = null,
    requestTimeoutMs = DEFAULT_WORKDAY_REQUEST_TIMEOUT_MS,
    circuitBreaker = workdayHostCircuitBreaker,
    requestScheduler = workdayRequestScheduler,
    jobsApiUrl = null,
    nativePayload = undefined,
    onNativePayload = null,
    validateNativePayload = null,
  } = {},
) => {
  let nativeDates = {}
  try {
    throwIfAborted(signal)
    circuitBreaker.assertRequestAllowed(jobUrl, source)
    // The public SEO page often flattens ATS bullets into one paragraph.
    // Keep the complete structured employer text as the classification source.
    const structuredUrl = buildWorkdayDetailApiUrl(jobUrl, jobsApiUrl)
    if (structuredUrl) {
      try {
        if (nativePayload !== undefined) {
          validateNativePayload?.(nativePayload)
          nativeDates = extractWorkdayNativeDateMetadata(nativePayload?.jobPostingInfo)
          const structured = extractWorkdayStructuredDetail(nativePayload)
          if (structured) return structured
        } else {
          const { response, bodyText } = await fetchWorkdayResource(structuredUrl, {
            headers: { accept: 'application/json', 'user-agent': WORKDAY_FETCH_USER_AGENT,
              ...(session?.bootstrapUrl ? { referer: session.bootstrapUrl } : {}),
              ...(session?.cookieHeader ? { cookie: session.cookieHeader } : {}) },
          }, { signal, timeoutMs: requestTimeoutMs, source, requestScheduler, kind: 'detail' },
          async response => ({ response, bodyText: await response.text() }))
          if (response.status === 429 || response.status >= 500) throw buildWorkdayHttpFailureError(source, structuredUrl, response.status, response.headers)
          const payload = response.ok ? JSON.parse(bodyText) : null
          validateNativePayload?.(payload)
          nativeDates = extractWorkdayNativeDateMetadata(payload?.jobPostingInfo)
          const structured = extractWorkdayStructuredDetail(payload)
          if (structured || nativeDates.sourceDateProvenance) onNativePayload?.(payload)
          if (structured) { circuitBreaker.recordSuccess(jobUrl); return structured }
        }
      } catch (error) {
        throwIfAborted(signal)
        if (['WORKDAY_NATIVE_DATE_INVALID', 'WORKDAY_NATIVE_ROLE_MISMATCH', 'WORKDAY_NATIVE_COUNTRY_MISMATCH', 'WORKDAY_NATIVE_ROLE_UNAVAILABLE'].includes(error?.code)) throw error
        const status = Number(error?.jobsApiHttpStatus ?? error?.httpStatus)
        if (status === 429 || status >= 500) throw error
        // Missing, blocked, or malformed API descriptions use the existing page path.
      }
    }
    const { response, html } = await fetchWorkdayResource(
      jobUrl,
      {
        headers: {
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'en-US',
          'user-agent': WORKDAY_FETCH_USER_AGENT,
          ...(session?.bootstrapUrl ? { referer: session.bootstrapUrl } : {}),
          ...(session?.cookieHeader ? { cookie: session.cookieHeader } : {}),
        },
      },
      {
        signal,
        timeoutMs: requestTimeoutMs,
        source,
        requestScheduler,
        kind: 'detail',
      },
      async (response) => ({
        response,
        html: await response.text(),
      }),
    )

    if (!response.ok) {
      throw buildWorkdayHttpFailureError(source, jobUrl, response.status, response.headers)
    }

    circuitBreaker.recordSuccess(jobUrl)
    return {
      locations: extractWorkdayDetailLocations(html),
      ...(await extractJobDetail({ provider: 'workday', html })),
      ...nativeDates,
    }
  } catch (error) {
    throwIfAborted(signal)
    if (['WORKDAY_NATIVE_DATE_INVALID', 'WORKDAY_NATIVE_ROLE_MISMATCH', 'WORKDAY_NATIVE_COUNTRY_MISMATCH', 'WORKDAY_NATIVE_ROLE_UNAVAILABLE'].includes(error?.code)) throw error
    circuitBreaker.recordFailure(jobUrl, error)
    if (shouldFallbackToListingDataAfterDetailFailure(error)) {
      logRecoverableWorkdayNotice(`  [${source}] Failed to enrich details for ${jobUrl}; keeping listing data when summary location remains safely in scope: ${error.message}`)
      return Object.assign(createFallbackDetailPayload(error), nativeDates)
    }

    if (error?.abortRetries === true) {
      throw markWorkdayTransportFailure(error)
    }

    logRecoverableWorkdayNotice(`  [${source}] Failed to enrich details for ${jobUrl}: ${error.message}`)
    return { ...emptyDetailPayload(), ...nativeDates }
  }
}

const buildWorkdayIncompleteListingError = (source, reason, classification = {}) => {
  const error = new Error('[' + source + '] Workday listing is incomplete: ' + reason)
  error.name = 'WorkdayIncompleteListingError'
  error.abortRetries = true
  error.failureKind = classification.failureKind || 'parser_or_contract_error'
  if (classification.softFailure === true) error.softFailure = true
  if (classification.upstreamOutage != null) {
    error.upstreamOutage = classification.upstreamOutage === true
  }
  return error
}

const buildWorkdayInventoryChangedError = (source, reason) => Object.assign(
  buildWorkdayIncompleteListingError(source, reason, {
    softFailure: true, upstreamOutage: false, failureKind: 'upstream_inventory_changed',
  }), { code: 'WORKDAY_INVENTORY_CHANGED' },
)

const resolveSelectedWorkdayCountryFacetTotal = (payload, appliedFacets, searchText) => {
  if (String(searchText || '').trim()) return null
  const selectedFacets = Object.entries(appliedFacets || {})
    .filter(([, values]) => Array.isArray(values) && values.length > 0)
  if (selectedFacets.length !== 1) return null
  const [[facetKey, selectedIds]] = selectedFacets
  if (!isWorkdayCountryFacetKey(facetKey) || selectedIds.length !== 1) return null
  const selectedId = String(selectedIds[0])

  const findSelectedCount = (value, countryFacet = false) => {
    if (Array.isArray(value)) {
      return value.reduce((max, item) => Math.max(max, findSelectedCount(item, countryFacet) ?? -1), -1)
    }
    if (!value || typeof value !== 'object') return null
    const insideCountryFacet = countryFacet || isWorkdayCountryFacetKey(value.facetParameter)
    if (insideCountryFacet && String(value.id || '') === selectedId) {
      const count = Number(value.count)
      if (Number.isInteger(count) && count >= 0) return count
    }
    const counts = Object.values(value)
      .map((item) => findSelectedCount(item, insideCountryFacet))
      .filter((count) => count != null)
    return counts.length ? Math.max(...counts) : null
  }

  return findSelectedCount(payload?.facets)
}

const buildWorkdayIncompleteScopeError = (source, jobUrl, cause) => {
  const error = new Error('[' + source + '] Workday cannot establish India scope for ' + jobUrl + ' without complete job locations', { cause })
  error.name = 'WorkdayIncompleteScopeError'
  error.softFailure = true
  error.abortRetries = true
  error.failureKind = 'incomplete_location_scope'
  return error
}

const buildWorkdayScopeContractError = (source, url, cause) => Object.assign(
  new Error('[' + source + '] Workday scope API expected JSON from the same native detail URL at ' + url, { cause }),
  { name: 'WorkdayScopeApiContractError', abortRetries: true, failureKind: 'parser_or_contract_error' },
)

const resolveWorkdayCxsPrimaryLocation = (info = {}) => (
  info.location == null || (typeof info.location === 'string' && !info.location.trim())
    ? info.jobRequisitionLocation?.descriptor
    : info.location
)

// The requisition office has its own country and may differ from all public
// posting locations. Only an explicitly listed office can be published.
const resolveWorkdayRequisitionLocationBinding = (info = {}) => {
  const nested = info.jobRequisitionLocation
  if (!nested?.country || typeof info.location !== 'string') return null
  const countryLabels = country => (typeof country === 'string'
    ? [country] : [country?.descriptor, country?.alpha2Code])
    .filter(value => typeof value === 'string' && value.trim())
    .map(value => value.trim().toLowerCase())
  const officeKey = (label, countries) => {
    let key = typeof label === 'string' ? label.trim().toLowerCase() : ''
    for (const country of countries.flatMap(countryLabels)) {
      if (key.endsWith(', ' + country)) key = key.slice(0, -(country.length + 2)).trim()
    }
    return key
  }
  const nestedKey = officeKey(nested.descriptor, [nested.country])
  if (!info.location.trim()) return null
  if (!nestedKey || /^unknown$/i.test(nestedKey) || isGroupedLocationLabel(nested.descriptor)
    || !countryLabels(nested.country).length) return info.country ? null : { publicLocation: null }
  if (nestedKey === officeKey(info.location, [info.country, nested.country])) return null
  const matches = (Array.isArray(info.additionalLocations) ? info.additionalLocations : [])
    .filter(location => officeKey(location, [nested.country]) === nestedKey)
  return { publicLocation: matches.length === 1 ? matches[0] : null }
}

const resolveWorkdayCxsPrimaryCountryScope = (info = {}) => {
  const nestedCountry = resolveWorkdayRequisitionLocationBinding(info) ? null : info.jobRequisitionLocation?.country
  const countryValues = [
    typeof info.country === 'string' ? info.country : null,
    info.country?.descriptor,
    info.country?.alpha2Code,
    typeof nestedCountry === 'string' ? nestedCountry : null,
    nestedCountry?.descriptor,
    nestedCountry?.alpha2Code,
  ].filter((value) => typeof value === 'string' && value.trim())
  const hasIndia = countryValues.some((value) => /^(?:india|in|ind)$/i.test(value.trim()))
  const hasForeign = countryValues.some((value) => {
    const country = value.trim()
    return !/^(?:india|in|ind|unknown|multiple countries?)$/i.test(country)
      && (/^[A-Z]{2}$/i.test(country) || /^[\p{L}][\p{L}\s.'()-]+$/u.test(country))
  })
  if (hasIndia === hasForeign) return null
  return hasIndia ? 'india' : 'foreign'
}

// The HTML can expose only a foreign primary address for a multi-location role.
// CXS supplies the additional locations needed to decide whether India is included.
const fetchWorkdayScopePayload = async ({
  candidate, jobsApiUrl, source, session, signal, requestTimeoutMs,
  retryBaseDelayMs, circuitBreaker, requestScheduler, countryProof = false,
  allowUnresolvedLocations = false,
}) => {
  const jobPath = new URL(candidate.canonicalLink).pathname.match(/\/job\/.+$/)?.[0]
  if (!jobPath) throw buildWorkdayIncompleteScopeError(source, candidate.canonicalLink)
  const detailApiUrl = new URL(jobsApiUrl)
  detailApiUrl.pathname = detailApiUrl.pathname.replace(/\/jobs\/?$/, '') + jobPath
  detailApiUrl.search = ''

  try {
    for (let attempt = 1; attempt <= WORKDAY_JOBS_API_RETRY_ATTEMPTS; attempt += 1) {
      throwIfAborted(signal)
      circuitBreaker.assertRequestAllowed(detailApiUrl.href, source)
      try {
        const { response, payload } = await fetchWorkdayResource(
          detailApiUrl.href,
          {
            headers: {
              accept: 'application/json',
              'accept-language': 'en-US',
              'user-agent': WORKDAY_FETCH_USER_AGENT,
              ...(session?.bootstrapUrl ? { referer: session.bootstrapUrl } : {}),
              ...(session?.cookieHeader ? { cookie: session.cookieHeader } : {}),
            },
          },
          { signal, timeoutMs: requestTimeoutMs, source, requestScheduler, kind: 'listing' },
          async (response) => {
            let payload = null
            if (response.ok) {
              try { payload = await response.json() } catch (error) {
                if (!(error instanceof SyntaxError)) throw error
                throw buildWorkdayScopeContractError(source, detailApiUrl.href, error)
              }
            } else await response.text()
            return { response, payload }
          },
        )
        if (!response.ok) {
          throw buildWorkdayHttpFailureError(source, detailApiUrl.href, response.status, response.headers)
        }
        if (countryProof && (response.url !== detailApiUrl.href
          || !/^application\/(?:[\w.-]+\+)?json(?:\s*;|$)/i.test(response.headers?.get?.('content-type') || ''))) {
          throw buildWorkdayScopeContractError(source, detailApiUrl.href,
            new Error('Native Workday country detail response URL or JSON content type is invalid'))
        }

        const info = payload?.jobPostingInfo
        const locations = [resolveWorkdayCxsPrimaryLocation(info), ...(Array.isArray(info?.additionalLocations) ? info.additionalLocations : [])]
        const expectedCount = Number(candidate.location.match(/^(\d+)\s+locations?$/i)?.[1]) || 1
        if (
          !info || (info.additionalLocations != null && !Array.isArray(info.additionalLocations))
          || Array.isArray(info.additionalLocations) && info.additionalLocations.some(value => typeof value !== 'string')
        ) {
          throw buildWorkdayIncompleteScopeError(source, candidate.canonicalLink,
            new Error('CXS job location payload is missing or ambiguous'))
        }
        const normalizedLocations = locations.map(value => typeof value === 'string' ? value.trim() : '')
        if (!allowUnresolvedLocations) {
          if (normalizedLocations.some(value => !value || isGroupedLocationLabel(value) || /^unknown$/i.test(value))) {
            throw buildWorkdayIncompleteScopeError(source, candidate.canonicalLink,
              new Error('CXS job location payload is missing or ambiguous'))
          }
          if (normalizedLocations.length < expectedCount) {
            throw buildWorkdayIncompleteScopeError(source, candidate.canonicalLink,
              new Error('CXS supplied ' + normalizedLocations.length + ' of ' + expectedCount + ' job locations'))
          }
        }
        circuitBreaker.recordSuccess(detailApiUrl.href)
        return payload
      } catch (error) {
        throwIfAborted(signal)
        if (shouldCountWorkdayHostCircuitFailure(error)) circuitBreaker.recordFailure(detailApiUrl.href, error)
        if (error?.abortRetries === true || attempt >= WORKDAY_JOBS_API_RETRY_ATTEMPTS || !isRetryableWorkdayJobsApiError(error)) throw error
        await delay(resolveWorkdayRetryDelayMs(error, attempt, retryBaseDelayMs), signal)
      }
    }
  } catch (error) {
    throwIfAborted(signal)
    // Only geographic validation above is incomplete location scope. Keep the
    // original HTTP/transport/contract failure and its status/retry metadata.
    throw error
  }
}

const workdayLocationEvidenceKey = value => String(value || '').trim().toLowerCase()
export const WORKDAY_ADDITIONAL_WORKSITE_PROOF = Symbol.for('jobverify.workday.additional-worksite-country-proof')

// Opt-in data from a source-owned, fully reconciled public office directory.
// This does not resolve a city globally or replace any typed CXS country.
export const validateWorkdayAdditionalWorksiteProof = (input, {
  source, baseUrl, jobsApiUrl, officialCareersUrl, countryProof, now = Date.now(),
}) => {
  if (input == null) return null
  const requireProof = condition => {
    if (!condition) throw Object.assign(new Error('Invalid current Workday worksite country proof'), { abortRetries: true })
  }
  const plain = value => value && typeof value === 'object' && !Array.isArray(value)
  const dataOnly = root => {
    const stack = [[root, false]], visited = new Set(), active = new Set()
    let fields = 0
    while (stack.length) {
      const [value, leaving] = stack.pop()
      if (leaving) { active.delete(value); visited.add(value); continue }
      if (value === null || typeof value === 'string' || typeof value === 'boolean'
        || typeof value === 'number' && Number.isFinite(value)) continue
      if (typeof value !== 'object' || active.has(value)
        || ![Object.prototype, Array.prototype, null].includes(Object.getPrototypeOf(value))) return false
      if (visited.has(value)) continue
      active.add(value); stack.push([value, true])
      for (const key of Reflect.ownKeys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key)
        if (++fields > 100000 || typeof key !== 'string' || !Object.hasOwn(descriptor, 'value')) return false
        stack.push([descriptor.value, false])
      }
    }
    return true
  }
  const sha = value => typeof value === 'string' && /^[a-f\d]{64}$/.test(value)
  const text = value => typeof value === 'string' && !!value.trim()
  const time = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
  requireProof(dataOnly(input))
  if (input.version === 'aurecon-native-worksites-v2') return validateAureconWorksiteProof(input, {
    source, baseUrl, jobsApiUrl, officialCareersUrl, countryProof, now,
  })
  requireProof(dataOnly(input) && plain(input) && countryProof === true && input.version === 'workday-additional-worksites-v1'
    && input.source === source && input.jobsApiUrl === jobsApiUrl && input.boardUrl === baseUrl
    && input.officialCareersUrl === officialCareersUrl && time(input.verifiedAt))
  const startedAt = Date.parse(input.attemptStartedAt), deadlineAt = Date.parse(input.attemptDeadlineAt), verifiedAt = Date.parse(input.verifiedAt)
  // A directory receipt is current only inside this bounded source attempt.
  // Ten minutes is the existing extraction-audit ceiling; the source supplies
  // its own shorter deadline (Temenos uses three minutes by default).
  requireProof(Number.isFinite(now) && Number.isFinite(startedAt) && Number.isFinite(deadlineAt)
    && startedAt <= verifiedAt && verifiedAt <= now && now <= deadlineAt
    && deadlineAt > startedAt && deadlineAt - startedAt <= 600000)
  const inCurrentAttempt = value => time(value) && Date.parse(value) >= startedAt && Date.parse(value) <= verifiedAt
  let directory, corporate
  try { directory = new URL(input.directoryUrl); corporate = new URL(officialCareersUrl) } catch { requireProof(false) }
  requireProof(directory.protocol === 'https:' && directory.origin === corporate.origin
    && !directory.username && !directory.password && !directory.search && !directory.hash && directory.pathname.endsWith('/'))
  const receipt = input.corporateReceipt
  const nativeBoard = new URL(baseUrl)
  const nativeBoardKey = nativeBoard.origin + '/' + nativeBoard.pathname.split('/').filter(Boolean)
    .filter(part => !/^[a-z]{2}-[a-z]{2}$/i.test(part)).join('/')
  requireProof(plain(receipt) && receipt.status === 200 && receipt.requestedUrl === officialCareersUrl
    && receipt.responseUrl === officialCareersUrl && sha(receipt.sha256) && inCurrentAttempt(receipt.fetchedAt)
    && receipt.board === nativeBoardKey
    && /^(?:text\/html|application\/xhtml\+xml)(?:\s*;|$)/i.test(receipt.contentType || '')
    && inferWorkdayJobsApiConfig(receipt.anchorUrl)?.jobsApiUrl === jobsApiUrl
    && inferWorkdayJobsApiConfig(baseUrl)?.jobsApiUrl === jobsApiUrl)
  requireProof(Array.isArray(input.snapshots) && input.snapshots.length === 2)
  const snapshots = structuredClone(input.snapshots)
  // These are explicit country-name spellings, never city/HQ aliases. Keep
  // the original publisher line; compare only its recognized country identity.
  const countryNames = new Map([['the netherlands', 'Netherlands'], ['republic of south africa', 'South Africa'],
    ['kingdom of saudi arabia', 'Saudi Arabia'], ['bosnia and herzegovina', 'Bosnia & Herzegovina']])
  const pageNumber = value => {
    let url
    try { url = new URL(value) } catch { return null }
    if (url.origin !== directory.origin || url.search || url.hash || url.username || url.password) return null
    if (url.pathname === directory.pathname) return 1
    const suffix = url.pathname.startsWith(directory.pathname) && url.pathname.slice(directory.pathname.length)
    return typeof suffix === 'string' && /^page\/[1-9]\d*\/$/.test(suffix) ? Number(suffix.split('/')[1]) : null
  }
  const groupSnapshots = snapshots.map(snapshot => {
    requireProof(plain(snapshot) && Number.isSafeInteger(snapshot.reportedTotal) && snapshot.reportedTotal >= 0
      && snapshot.reportedTotal <= 1000 && Array.isArray(snapshot.records) && snapshot.records.length === snapshot.reportedTotal
      && Array.isArray(snapshot.pages) && snapshot.pages.length > 0 && snapshot.pages.length <= 20)
    const ids = new Map(), positions = new Set(), pages = new Map(), covered = new Set(), groups = new Map()
    for (const record of snapshot.records) {
      requireProof(plain(record) && Number.isSafeInteger(record.id) && record.id > 0 && !ids.has(record.id)
        && Number.isSafeInteger(record.position) && record.position > 0 && record.position <= snapshot.reportedTotal
        && !positions.has(record.position) && text(record.label) && text(record.employerEntity)
        && Array.isArray(record.addressLines) && record.addressLines.length >= 2 && record.addressLines.every(text)
        && record.publisherCountryText === record.addressLines.at(-1) && sha(record.sourceCardSHA256)
        && pageNumber(record.sourceUrl) !== null && (record.country === null || plain(record.country)
          && /^[A-Z]{2}$/.test(record.country.alpha2Code || '') && text(record.country.descriptor)
          && hasRecognizedWorkdayCountry(record.country) && hasRecognizedWorkdayCountry({
            descriptor: countryNames.get(record.publisherCountryText.trim().toLowerCase()) || record.publisherCountryText,
            alpha2Code: record.country.alpha2Code })))
      ids.set(record.id, record); positions.add(record.position)
      const key = workdayLocationEvidenceKey(record.label)
      const group = groups.get(key) || []; group.push(record); groups.set(key, group)
    }
    for (const page of snapshot.pages) {
      requireProof(plain(page) && page.status === 200 && sha(page.sha256) && inCurrentAttempt(page.fetchedAt)
        && Number.isSafeInteger(page.pageNumber) && page.pageNumber > 0
        && pageNumber(page.url) === page.pageNumber && !pages.has(page.pageNumber)
        && page.reportedTotal === snapshot.reportedTotal && Array.isArray(page.worksiteIds)
        && page.worksiteIds.every(id => ids.has(id) && !covered.has(id) && ids.get(id).sourceUrl === page.url))
      for (const id of page.worksiteIds) { requireProof(!covered.has(id)); covered.add(id) }
      pages.set(page.pageNumber, page)
    }
    requireProof(covered.size === ids.size && [...pages.keys()].every(n => n >= 1 && n <= pages.size)
      && Array.from({ length: snapshot.reportedTotal }, (_, i) => i + 1).every(n => positions.has(n)))
    return groups
  })
  requireProof(Math.max(...snapshots[0].pages.map(p => Date.parse(p.fetchedAt)))
    <= Math.min(...snapshots[1].pages.map(p => Date.parse(p.fetchedAt))))
  const byLabel = new Map()
  const stableRecords = records => JSON.stringify(records.map(({ sourceUrl, position, ...record }) => record).sort((a, b) => a.id - b.id))
  for (const [label, records] of groupSnapshots[0]) {
    const closing = groupSnapshots[1].get(label)
    if (!closing || /\b(?:remote|hybrid|global|worldwide|anywhere|unknown|multiple|various)\b/i.test(label)
      || isGroupedLocationLabel(label) || explicitWorkdayCountryScope(label)
      || stableRecords(records) !== stableRecords(closing) || records.some(record => !record.country)) continue
    const codes = new Set(records.map(record => new Intl.Locale('und-' + record.country.alpha2Code).region))
    if (codes.size !== 1) continue
    const code = [...codes][0]
    byLabel.set(label, { label: records[0].label, country: { descriptor: records[0].country.descriptor, alpha2Code: code },
      scope: code === 'IN' ? 'india' : 'foreign', worksiteIds: records.map(record => record.id).sort((a, b) => a - b),
      directoryUrl: directory.href, worksiteRecords: structuredClone(records),
      snapshots: snapshots.map(snapshot => ({ reportedTotal: snapshot.reportedTotal, pages: structuredClone(snapshot.pages) })) })
  }
  return { source, jobsApiUrl, boardUrl: baseUrl, directoryUrl: directory.href,
    corporateReceipt: structuredClone(receipt), verifiedAt: input.verifiedAt, snapshots, byLabel }
}
// City-only secondary labels do not carry the primary location's country.
// These known non-India cities can be excluded independently; unknown campus
// labels still require current native country evidence from this board.
const WORKDAY_NON_INDIA_CITY_LABELS = new Set([
  'launceston', 'brisbane', 'perth', 'townsville', 'adelaide', 'melbourne',
])

// Bind countries to the office they describe. Opaque labels may reuse only
// matching office-country evidence from this run.
const buildWorkdayLocationCountryEvidence = candidates => {
  const evidence = new Map()
  for (const candidate of candidates) {
    const info = candidate.scopePayload?.jobPostingInfo
    const binding = resolveWorkdayRequisitionLocationBinding(info)
    const secondary = binding?.publicLocation
    const bindings = [{ label: resolveWorkdayCxsPrimaryLocation(info),
      countries: [info.country, ...(binding ? [] : [info.jobRequisitionLocation?.country])].filter(Boolean) }]
    if (secondary) bindings.push({ label: secondary, countries: [info.jobRequisitionLocation.country] })
    candidate.scopeCountryConflict = false
    for (const binding of bindings) {
      const { countries } = binding
      const scope = resolveWorkdayCxsPrimaryCountryScope({ country: countries[0], jobRequisitionLocation: { country: countries[1] } })
      const fields = countries.map(country => typeof country === 'string'
        ? { [/^[a-z]{2}$/i.test(country.trim()) ? 'code' : 'name']: workdayLocationEvidenceKey(country) }
        : Object.fromEntries([['code', 'alpha2Code'], ['name', 'descriptor'], ['id', 'id']]
          .flatMap(([key, property]) => typeof country[property] === 'string' && country[property].trim()
            ? [[key, workdayLocationEvidenceKey(country[property])]] : [])))
      const countryScopes = countries.map(country => resolveWorkdayCxsPrimaryCountryScope({ country })).filter(Boolean)
      const conflict = new Set(countryScopes).size > 1 || fields.some((country, index) => fields.slice(index + 1).some(other => (
        !['code', 'id'].some(key => country[key] && country[key] === other[key])
        && ['code', 'name', 'id'].some(key => country[key] && other[key] && country[key] !== other[key])
      )))
      candidate.scopeCountryConflict ||= conflict
      if (!scope && !conflict) continue
      const identifiers = new Set(fields.flatMap(country => Object.entries(country).map(([key, value]) => key + ':' + value)))
      if (!identifiers.size) continue
      const label = workdayLocationEvidenceKey(binding.label)
      const previous = evidence.get(label)
      if (!previous) evidence.set(label, { scope, identifiers, conflict })
      else {
        const strongConflict = ['code:', 'id:'].some(prefix => {
          const oldValues = [...previous.identifiers].filter(value => value.startsWith(prefix))
          const newValues = [...identifiers].filter(value => value.startsWith(prefix))
          return oldValues.length > 0 && newValues.length > 0 && !newValues.some(value => previous.identifiers.has(value))
        })
        if (conflict || strongConflict || previous.scope !== scope || ![...identifiers].some(value => previous.identifiers.has(value))) previous.conflict = true
        for (const value of identifiers) previous.identifiers.add(value)
      }
    }
  }
  return evidence
}

const resolveWorkdayScopeLocations = (candidate, countryEvidence, source, countryProof = false, worksiteProof = null) => {
  try {
    if (candidate.scopeCountryConflict) throw new Error('CXS primary country fields conflict')
    const info = candidate.scopePayload.jobPostingInfo
    const rawLocations = [resolveWorkdayCxsPrimaryLocation(info), ...(info.additionalLocations || [])]
    const expectedCount = Number(candidate.location.match(/^(\d+)\s+locations?$/i)?.[1]) || 1
    if (countryProof && (!info.country && !info.jobRequisitionLocation?.country
      || rawLocations.some(value => typeof value !== 'string' || !value.trim()
        || isGroupedLocationLabel(value) || /^unknown$/i.test(value.trim()))
      || rawLocations.length < expectedCount)) {
      throw Object.assign(new Error('CXS native geography is missing or ambiguous; country and complete public office locations are required'),
        { code: 'WORKDAY_NATIVE_LOCATIONS_UNRESOLVED' })
    }
    const locations = [...new Set(rawLocations.map(value => value.trim()))]
    const primaryScope = resolveWorkdayCxsPrimaryCountryScope(info)
    const scopes = locations.map((location, index) => {
      const known = countryEvidence.get(workdayLocationEvidenceKey(location))
      const worksite = index > 0 ? worksiteProof?.byLabel.get(workdayLocationEvidenceKey(location)) : null
      if (worksite && known && (known.scope !== worksite.scope || [...known.identifiers].some(value => {
        if (value.startsWith('code:')) return !hasRecognizedWorkdayCountry({ descriptor: worksite.country.descriptor, alpha2Code: value.slice(5) })
        if (value.startsWith('name:')) return !hasRecognizedWorkdayCountry({ descriptor: value.slice(5), alpha2Code: worksite.country.alpha2Code })
        return false
      }))) throw new Error('CXS typed country conflicts with current source worksite country: ' + location)
      if (countryProof && known?.conflict) throw new Error('CXS location has conflicting current primary-country evidence: ' + location)
      if (countryProof && index === 0 && primaryScope && explicitWorkdayAdditionalCountryScope(location)
        && primaryScope !== explicitWorkdayAdditionalCountryScope(location)) throw new Error('CXS location and country fields conflict: ' + location)
      if (index === 0 && primaryScope) return primaryScope
      if (known?.conflict) throw new Error('CXS location has conflicting current primary-country evidence: ' + location)
      if (known) return known.scope
      if (countryProof) {
        const explicit = explicitWorkdayAdditionalCountryScope(location)
        if (explicit) return explicit
        if (worksite) {
          candidate.additionalWorksiteCountryBindings ||= []
          candidate.additionalWorksiteCountryBindings.push(structuredClone(worksite))
          return worksite.scope
        }
        return null
      }
      if (isWorkdayJobInPublicIndiaScope({ location })) return 'india'
      if (WORKDAY_NON_INDIA_CITY_LABELS.has(workdayLocationEvidenceKey(location))) return 'foreign'
      if (isClearlyOutsidePublicIndiaScope({ location })) return 'foreign'
      return null
    })
    if (worksiteProof && scopes.some(scope => !scope)
      || !scopes.includes('india') && !scopes.every(scope => scope === 'foreign')) {
      throw Object.assign(new Error('CXS job locations do not establish India or foreign scope: '
        + locations.filter((_location, index) => !scopes[index]).join(' / ')),
      { code: 'WORKDAY_NATIVE_LOCATIONS_UNRESOLVED' })
    }
    const scopedLocations = locations.map((location, index) => scopes[index] === 'india' && !isWorkdayJobInPublicIndiaScope({ location })
      ? location + ', India' : location)
    return { locations: scopedLocations, countryScopes: scopes,
      indiaLocations: scopedLocations.filter((_location, index) => scopes[index] === 'india') }
  } catch (error) {
    const failure = buildWorkdayIncompleteScopeError(source, candidate.canonicalLink, error)
    if (error.code === 'WORKDAY_NATIVE_LOCATIONS_UNRESOLVED') failure.code = error.code
    throw failure
  }
}

const runWorkdayJobsApiPass = async ({
  company,
  baseUrl,
  locationCountry,
  source,
  config,
  boardIdentityVerified = false,
  signal = null,
  requestTimeoutMs = DEFAULT_WORKDAY_REQUEST_TIMEOUT_MS,
  retryBaseDelayMs = WORKDAY_JOBS_API_RETRY_BASE_DELAY_MS,
  circuitBreaker = workdayHostCircuitBreaker,
  requestScheduler = workdayRequestScheduler,
  detailCircuitBreaker = new WorkdayHostCircuitBreaker(),
  detailEnrichmentState = { disabled: false, noticeLogged: false },
  detailEnrichmentBudgetMs = null,
  nativeDetailRecovery = null,
  sourceWorksiteCountryProof = null,
  inventoryRestartState,
}) => {
  throwIfAborted(signal)
  const countryProof = config.inventoryScope === 'complete-board-country-proof'
  const redirectVanity = Object.hasOwn(config, 'officialVanityRedirectStatus')
  if (redirectVanity && (!countryProof || !config.officialVanityCareersUrl || config.officialVanityRedirectStatus !== 301)) {
    throw new Error('Unsupported explicit Workday vanity redirect configuration')
  }
  const countryFacetParameter =
    config.countryFacetParameter || DEFAULT_COUNTRY_FACET_PARAMETER
  const appliedFacets = countryProof ? {} : buildWorkdayAppliedFacets(
    baseUrl,
    locationCountry,
    countryFacetParameter,
  )
  const jobsApiUrl = config.jobsApiUrl
  const detailUrlBase = config.detailUrlBase || baseUrl
  const worksiteProof = validateWorkdayAdditionalWorksiteProof(sourceWorksiteCountryProof, {
    source, baseUrl, jobsApiUrl, officialCareersUrl: config.officialCareersUrl, countryProof,
  })
  // The shared maxPages setting limits DOM traversal; it must not truncate an
  // authoritative Workday API snapshot. An explicit API cap fails closed.
  const maxPages = Number.isInteger(config.workdayMaxPages) && config.workdayMaxPages > 0
    ? config.workdayMaxPages
    : Number.POSITIVE_INFINITY
  let effectiveAppliedFacets = appliedFacets
  let effectiveSearchText = countryProof ? '' : config.searchText || ''
  let retriedWithoutCountryFacet = false
  let retriedWithoutLocationFacets = false

  if (!jobsApiUrl) {
    throw new Error(`[${source}] listingStrategy "jobs-api" requires config.jobsApiUrl`)
  }

  try {
    const allJobs = []
    const allCandidates = []
    const initialInventory = new Map()
    const unresolvedCountryRoles = []
    let boardReceipt = null
    let provenBoardBootstrap = null
    if (countryProof) {
      try {
        if (config.officialVanityCareersUrl) {
          const readVanityPage = async (url, maxBytes, redirectBoard = null) => {
            const controller = new AbortController()
            const deadline = new WorkdayRequestTimeoutError(source, url, requestTimeoutMs)
            const timer = setTimeout(() => controller.abort(deadline), requestTimeoutMs)
            const boundarySignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
            const captureStartedAt = new Date().toISOString()
            try {
              return await fetchWorkdayResource(url,
                { headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': WORKDAY_FETCH_USER_AGENT }, cache: 'no-store', redirect: 'manual' },
                { signal: boundarySignal, timeoutMs: requestTimeoutMs, source, requestScheduler },
                async response => {
                  boundarySignal.throwIfAborted()
                  const body = redirectBoard
                    ? await readBoundedWorkdayVanityRedirect(response, { expectedUrl: url, boardUrl: redirectBoard, signal: boundarySignal, maxBytes })
                    : null
                  const html = redirectBoard ? null : await (redirectVanity ? readBoundedWorkdayVanityChainHtml : readBoundedWorkdayVanityHtml)(response, { expectedUrl: url, signal: boundarySignal, maxBytes })
                  boundarySignal.throwIfAborted()
                  const clocks = snapshotWorkdayVanityCaptureClocks(response, { captureStartedAt, capturedAt: new Date().toISOString() })
                  return redirectBoard ? { response, body, clocks } : { response, html, clocks }
                })
            } catch (error) {
              throwIfAborted(signal)
              boundarySignal.throwIfAborted()
              throw error
            } finally { clearTimeout(timer) }
          }
          const primary = await readVanityPage(config.officialCareersUrl, 4 * 1024 * 1024)
          throwIfAborted(signal)
          const handoff = currentWorkdayVanityHandoffReceipt({ officialCareersUrl: config.officialCareersUrl,
            vanityCareersUrl: config.officialVanityCareersUrl, boardUrl: baseUrl, ...primary })
          if (redirectVanity) {
            const redirected = await readVanityPage(config.officialVanityCareersUrl, 1024 * 1024, baseUrl)
            throwIfAborted(signal)
            const redirect = currentWorkdayVanityRedirectReceipt({ handoff, ...redirected })
            const native = await readVanityPage(baseUrl, 1024 * 1024)
            throwIfAborted(signal)
            boardReceipt = currentWorkdayVanityRedirectBoardReceipt({ handoff, redirect, ...native })
            provenBoardBootstrap = native
          } else {
            const native = await readVanityPage(config.officialVanityCareersUrl, 1024 * 1024)
            throwIfAborted(signal)
            boardReceipt = currentWorkdayVanityBoardReceipt({ handoff, ...native })
          }
        } else {
        const { response, html } = await fetchWorkdayResource(
          config.officialCareersUrl,
          { headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': WORKDAY_FETCH_USER_AGENT }, cache: 'no-store' },
          { signal, timeoutMs: requestTimeoutMs, source, requestScheduler },
          async response => ({ response, html: await response.text() }),
        )
        boardReceipt = currentWorkdayBoardReceipt({ officialCareersUrl: config.officialCareersUrl,
          boardUrl: baseUrl, response, html, renderProof: worksiteProof?.corporateRenderProof ?? null })
        }
        // The configured API must belong to the board the corporate page names.
        const inferred = inferWorkdayJobsApiConfig(baseUrl)
        if (!inferred || inferred.jobsApiUrl !== jobsApiUrl) throw new Error('Workday API does not match the corporate-bound tenant and site')
      } catch (error) {
        throwIfAborted(signal)
        if (config.officialVanityCareersUrl && error instanceof WorkdayRequestTimeoutError) throw error
        throw buildWorkdayIncompleteScopeError(source, config.officialCareersUrl || baseUrl, error)
      }
    }
    const seenLinks = new Set()
    const seenApiRecords = new Set()
    let reportedTotal = 0
    let pagesFetched = 0
    let offset = 0
    const searchUrl = countryProof
      ? (config.detailUrlBase || baseUrl).split(/[?#]/)[0]
      : buildWorkdaySearchUrl(config.detailUrlBase || baseUrl, locationCountry)
    const session = provenBoardBootstrap ? workdayJobsApiSessionFromResponse({
      response: provenBoardBootstrap.response, html: provenBoardBootstrap.html,
      bootstrapUrl: searchUrl, jobsApiUrl, source,
    }) : await bootstrapWorkdayJobsApiSession({
      bootstrapUrl: searchUrl,
      jobsApiUrl,
      source,
      signal,
      requestTimeoutMs,
      retryBaseDelayMs,
      circuitBreaker,
      requestScheduler,
    })

    const enumerateListing = async () => {
      for (let pageNum = 1; pageNum <= maxPages; pageNum += 1) {
        throwIfAborted(signal)
        let payload
        try {
          payload = await fetchWorkdayJobsApiPage({
            jobsApiUrl,
            bootstrapUrl: searchUrl,
            appliedFacets: effectiveAppliedFacets,
            offset,
            searchText: effectiveSearchText,
            source,
            session,
            signal,
            requestTimeoutMs,
            retryBaseDelayMs,
            circuitBreaker,
            requestScheduler,
            requireProofResponse: countryProof,
          })
        } catch (initialError) {
          let error = initialError
          throwIfAborted(signal)
          if (shouldRetryWithoutWorkdayCountryFacet({
            error,
            retryAttempted: retriedWithoutCountryFacet,
            locationCountry,
            appliedFacets: effectiveAppliedFacets,
          })) {
            retriedWithoutCountryFacet = true
            effectiveAppliedFacets = removeWorkdayCountryFacets(
              buildWorkdayAppliedFacets(baseUrl, null, countryFacetParameter),
            )
            effectiveSearchText = config.searchText || 'India'
            console.log(`  [${source}] Workday jobs API rejected the generic country facet; retrying with India search text.`)

            try {
              payload = await fetchWorkdayJobsApiPage({
                jobsApiUrl,
                bootstrapUrl: searchUrl,
                appliedFacets: effectiveAppliedFacets,
                offset,
                searchText: effectiveSearchText,
                source,
                session,
                signal,
                requestTimeoutMs,
                retryBaseDelayMs,
                circuitBreaker,
                requestScheduler,
              })
            } catch (retryError) {
              error = retryError
            }
          }

          if (!payload && shouldRetryWithoutWorkdayLocationFacets({
            error,
            retryAttempted: retriedWithoutLocationFacets,
            appliedFacets: effectiveAppliedFacets,
          })) {
            retriedWithoutLocationFacets = true
            effectiveAppliedFacets = removeWorkdayLocationFacets(
              buildWorkdayAppliedFacets(baseUrl, null, countryFacetParameter),
            )
            effectiveSearchText = config.searchText || 'India'
            console.log(`  [${source}] Workday jobs API rejected the remaining location facets; retrying with India search text only.`)

            try {
              payload = await fetchWorkdayJobsApiPage({
                jobsApiUrl,
                bootstrapUrl: searchUrl,
                appliedFacets: effectiveAppliedFacets,
                offset,
                searchText: effectiveSearchText,
                source,
                session,
                signal,
                requestTimeoutMs,
                retryBaseDelayMs,
                circuitBreaker,
                requestScheduler,
              })
            } catch (retryError) {
              error = retryError
            }
          }

          if (payload) {
            // Continue with the recovered page payload instead of falling back to DOM.
          } else if (
            !(error instanceof WorkdayUpstreamOutageError)
            && error?.upstreamOutage !== true
            && !isTransientWorkdayError(error)
          ) {
            const outageDetected = await probeWorkdaySearchPageForOutage(searchUrl, {
              signal,
              requestTimeoutMs,
              source,
              requestScheduler,
            })
            if (outageDetected) {
              throw buildWorkdayOutageError(source, searchUrl, error)
            }
          }

          if (payload) {
            // no-op
          } else {
            throw error
          }
        }
        pagesFetched += 1
        const jobs = payload.jobPostings
        // CXS can return total: 0 on later nonempty pages (e.g. Temenos).
        // Keep the first-page count; exact row counts and the closing snapshot
        // still have to reconcile before a complete-board proof is issued.
        if (countryProof && pageNum > 1 && payload.total !== 0 && payload.total !== reportedTotal) {
          throw buildWorkdayInventoryChangedError(source, 'complete-board total changed during enumeration')
        }
        reportedTotal = Math.max(reportedTotal, Number(payload.total) || 0)
        const selectedCountryFacetTotal = resolveSelectedWorkdayCountryFacetTotal(
          payload,
          effectiveAppliedFacets,
          effectiveSearchText,
        )
        if (selectedCountryFacetTotal > reportedTotal) {
          throw buildWorkdayIncompleteListingError(
            source,
            'selected country facet reports ' + selectedCountryFacetTotal
              + ' jobs but the API total is ' + reportedTotal,
            {
              softFailure: true,
              upstreamOutage: false,
              failureKind: 'upstream_inventory_unavailable',
            },
          )
        }
        const uniqueBeforePage = seenApiRecords.size

        if (!countryProof && pageNum === 1 && jobs.length === 0) {
          console.log(`  [${source}] 0 jobs found from Workday jobs API.`)
          return createWorkdayEmptyResult({
            boardIdentityVerified,
            hasIndiaCountryFacet: hasWorkdayCountryFacetValues(effectiveAppliedFacets),
            pagesFetched,
            reportedTotal,
            surface: jobsApiUrl,
          })
        }

        console.log(`  [${source}] Scraping page ${pageNum} - ${jobsApiUrl} (offset ${offset})`)
        console.log(`  [${source}] Page ${pageNum}: ${jobs.length} job records`)

        for (const [rowIndex, job] of jobs.entries()) {
          const canonicalLink = countryProof && typeof job?.externalPath !== 'string' ? null
            : buildWorkdayJobDetailUrl(job.externalPath, detailUrlBase, baseUrl)
          if (countryProof) {
            const apiBoard = new URL(jobsApiUrl).pathname.match(/^\/wday\/cxs\/([^/]+)\/([^/]+)\/jobs$/)
            const expectedRolePath = '/' + apiBoard?.[2] + job?.externalPath
            const actualRolePath = canonicalLink && new URL(canonicalLink).pathname.replace(/^\/[a-z]{2}-[a-z]{2}(?=\/)/i, '')
            const identityFailure = !apiBoard ? 'invalid-api-board'
              : typeof job?.title !== 'string' || !job.title.trim() ? 'missing-title'
                : typeof job.externalPath !== 'string' || !/^\/job\/.*_[^/]+$/.test(job.externalPath) ? 'invalid-external-path'
                  : !canonicalLink || actualRolePath !== expectedRolePath ? 'outside-board' : null
            if (identityFailure) {
              const diagnostic = workdayListingIdentityDiagnostic({ reason: identityFailure,
                board: boardReceipt?.board || baseUrl, rowIndex: offset + rowIndex, externalPath: job?.externalPath })
              throw Object.assign(buildWorkdayIncompleteListingError(source,
                'complete-board role identity is missing, duplicate, or outside this board ' + JSON.stringify(diagnostic)),
              { listingIdentity: diagnostic })
            }
            if (initialInventory.has(canonicalLink)) throw buildWorkdayInventoryChangedError(source, 'complete-board role identity repeated during pagination')
            initialInventory.set(canonicalLink, workdayInventoryIdentity(job))
          }
          seenApiRecords.add(canonicalLink || JSON.stringify(job))
          if (!canonicalLink || seenLinks.has(canonicalLink)) continue

          const location = resolveWorkdaySummaryLocation(job)
          if (countryProof ? explicitWorkdayCountryScope(location) === 'foreign'
            : !shouldFetchWorkdayJobDetail({ location }, config.locationPattern)) {
            continue
          }

          seenLinks.add(canonicalLink)
          allCandidates.push({ job, canonicalLink, location,
            receiptKey: nativeDetailReceiptKey('workday', source, jobsApiUrl, canonicalLink, job.title, location, job.postedOn, job.bulletFields),
          })
        }

        if (jobs.length > 0 && seenApiRecords.size === uniqueBeforePage) {
          throw buildWorkdayInventoryChangedError(source, 'API page ' + pageNum + ' repeated previously seen jobs')
        }
        offset += jobs.length
        const hasMore = offset < reportedTotal || shouldContinueWorkdayJobsApiPagination({
          jobsCount: jobs.length,
          offsetAfterPage: offset,
          payloadTotal: reportedTotal,
        })
        if (jobs.length === 0 || !hasMore) {
          if (seenApiRecords.size < reportedTotal) {
            throw buildWorkdayInventoryChangedError(source, 'received ' + seenApiRecords.size + ' unique jobs of ' + reportedTotal + ' reported jobs')
          }
          break
        }
        if (pageNum === maxPages) {
          throw buildWorkdayIncompleteListingError(source, 'reached the ' + maxPages + '-page API limit')
        }
      }
    }
    // Live boards can add/remove postings between offset requests. Discard
    // that pass and make one fresh enumeration before any role hydration.
    // Temporarily incomplete role objects can also appear while a live board
    // updates. Discard the whole pass; never skip or fabricate their identity.
    // A second unstable or malformed pass remains a hard failure.
    let emptyListing
    try { emptyListing = await enumerateListing() } catch (error) {
      throwIfAborted(signal)
      const incompleteIdentity = error.name === 'WorkdayIncompleteListingError'
        && ['missing-title', 'invalid-external-path'].includes(error.listingIdentity?.reason)
      if (inventoryRestartState.used || error.code !== 'WORKDAY_INVENTORY_CHANGED' && !incompleteIdentity) throw error
      inventoryRestartState.used = true
      seenLinks.clear(); seenApiRecords.clear(); initialInventory.clear()
      allCandidates.length = 0; reportedTotal = 0; offset = 0
      console.log(`  [${source}] Workday inventory changed or a role identity was incomplete; restarting the listing once.`)
      emptyListing = await enumerateListing()
    }
    if (emptyListing !== undefined) return emptyListing

    // Required geography checks use the source deadline. Resolve these before
    // optional HTML enrichment starts its separate, shorter budget.
    const scopeCandidates = allCandidates.filter(({ location }) => countryProof
      ? explicitWorkdayCountryScope(location) !== 'india'
      : !isWorkdayJobInPublicIndiaScope({ location, city: extractCity(location) }))
    const nativeRoleIdentity = (info, candidate) => {
      const posting = new URL(candidate.canonicalLink).pathname.split('/').at(-1)
      const reqId = typeof info?.jobReqId === 'string' ? info.jobReqId.trim() : null
      const canonicalMatches = typeof info?.externalUrl === 'string'
        && matchesWorkdayNativeRoleUrl(info.externalUrl, candidate.canonicalLink)
      const nativePostingMatches = info?.jobPostingId === posting
      // Requisitions can contain underscores. Match the complete supplied ID,
      // including Workday's numeric suffix for a repeated public posting.
      const reqSuffix = reqId && posting.slice(posting.lastIndexOf('_' + reqId))
      const repeatedPosting = reqId && reqSuffix?.startsWith('_' + reqId + '-')
        && /^\d+$/.test(reqSuffix.slice(reqId.length + 2))
      const reqMatches = Boolean(reqId && (posting.endsWith('_' + reqId)
        || repeatedPosting && (canonicalMatches || nativePostingMatches)))
      // Some boards intentionally expose an empty requisition. Accept that
      // native contract only when both independent public posting fields bind it.
      const postingIdentityMatches = reqId === '' && canonicalMatches && nativePostingMatches
      return { reqId, reqMatches, canonicalMatches, postingIdentityMatches }
    }
    const matchesNativeRole = (payload, candidate) => {
      const info = payload?.jobPostingInfo
      const { reqMatches, canonicalMatches, postingIdentityMatches } = nativeRoleIdentity(info, candidate)
      return Boolean(info && (reqMatches || !countryProof && postingIdentityMatches)
        && (info.externalUrl == null || canonicalMatches)
        && (!countryProof || canonicalMatches && typeof info.jobPostingSiteId === 'string'
          && info.jobPostingSiteId.toLowerCase() === new URL(jobsApiUrl).pathname.split('/').at(-2).toLowerCase())
        && typeof info.title === 'string' && typeof candidate.job.title === 'string'
        && info.title.trim() === candidate.job.title.trim())
    }
    const validateNativeRole = (payload, candidate) => {
      const info = payload?.jobPostingInfo
      if (countryProof && !matchesNativeRole(payload, candidate)) {
        throw buildWorkdayIncompleteScopeError(source, candidate.canonicalLink,
          new Error('Native Workday detail lacks the matching requisition, title, site, or canonical same-board URL'))
      }
      const suppliedCountries = [info?.country, info?.jobRequisitionLocation?.country].filter(country => country != null)
      if (countryProof && !suppliedCountries.length && config.retainProvenIndiaOnUnresolvedLocations !== true
        || suppliedCountries.some(country => !hasRecognizedWorkdayCountry(country))) {
        throw Object.assign(buildWorkdayIncompleteScopeError(source, candidate.canonicalLink,
          new Error('Native Workday country fields are unrecognized or conflicting')),
        { code: 'WORKDAY_NATIVE_COUNTRY_MISMATCH' })
      }
      if (!info) return
      const { reqMatches, postingIdentityMatches } = nativeRoleIdentity(info, candidate)
      if (info.jobReqId != null && !reqMatches && !postingIdentityMatches
        || info.title != null && (typeof info.title !== 'string' || info.title.trim() !== candidate.job.title?.trim())
        || info.externalUrl != null && !matchesWorkdayNativeRoleUrl(info.externalUrl, candidate.canonicalLink)) {
        throw Object.assign(new Error(`[${source}] Native Workday detail identity conflicts with ${candidate.canonicalLink}`), {
          name: 'WorkdayNativeRoleMismatchError', code: 'WORKDAY_NATIVE_ROLE_MISMATCH',
          abortRetries: true, failureKind: 'parser_or_contract_error',
        })
      }
      // A current, identity-bound explicit false cannot be replaced with an
      // optional HTML/JD or listing fallback. It is not a closed-state proof.
      const unavailableFields = ['posted', 'canApply'].filter(field => Object.hasOwn(info, field) && info[field] === false)
      if ((reqMatches || postingIdentityMatches) && unavailableFields.length) {
        // Preserve strict supplied native date failures before qualification.
        extractWorkdayNativeDateMetadata(info)
        throw Object.assign(new Error(`[${source}] Native Workday role is unavailable (${unavailableFields.join(', ')}:false) in native application details: ${candidate.canonicalLink}`), {
          name: 'WorkdayNativeRoleUnavailableError', code: 'WORKDAY_NATIVE_ROLE_UNAVAILABLE',
          abortRetries: true, softFailure: true, partial: true, failureKind: 'native_role_unavailable',
          sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false,
          nativeStatus: Object.fromEntries(['posted', 'canApply'].filter(field => Object.hasOwn(info, field)).map(field => [field, info[field]])),
        })
      }
    }
    const validateRequiredScopeRole = candidate => {
      try {
        validateNativeRole(candidate.scopePayload, candidate)
      } catch (error) {
        if (!countryProof || config.retainProvenIndiaOnUnresolvedLocations !== true
          || error?.code !== 'WORKDAY_NATIVE_ROLE_UNAVAILABLE') throw error
        // Only this unavailable role may supply its own country evidence.
        // It must never turn a proven India availability failure into an
        // unresolved audit record or classify another role through the map.
        const info = candidate.scopePayload.jobPostingInfo
        const ownCountryEvidence = buildWorkdayLocationCountryEvidence([candidate])
        try {
          resolveWorkdayScopeLocations(candidate, ownCountryEvidence, source, true)
        } catch (scopeError) {
          if (scopeError.code !== 'WORKDAY_NATIVE_LOCATIONS_UNRESOLVED') throw scopeError
        }
        const ownLocations = [resolveWorkdayCxsPrimaryLocation(info), ...(info.additionalLocations || [])]
        if (resolveWorkdayCxsPrimaryCountryScope(info) === 'india'
          || ownLocations.some(location => typeof location === 'string' && (
            explicitWorkdayCountryScope(location) === 'india'
            || ownCountryEvidence.get(workdayLocationEvidenceKey(location))?.scope === 'india'))) throw error
        candidate.unavailableNativeRole = error
      }
    }
    const scopeController = new AbortController()
    const scopeSignal = signal ? AbortSignal.any([signal, scopeController.signal]) : scopeController.signal
    const scopeTimer = nativeDetailRecovery && scopeCandidates.length
      ? setTimeout(() => scopeController.abort(new NativeDetailRecoveryPendingError(scopeCandidates.length)),
        nativeDetailPassBudget(nativeDetailRecovery, NATIVE_DETAIL_SCOPE_PASS_MS)) : null
    try {
      await mapWithConcurrency(
        scopeCandidates,
        resolveWorkdayDetailFetchConcurrency(process.env.WORKDAY_DETAIL_FETCH_CONCURRENCY, config.detailFetchConcurrency),
        async (candidate) => {
          const cached = countryProof ? null : readNativeDetailReceipt(nativeDetailRecovery, candidate.receiptKey)
          if (cached && matchesNativeRole(cached.payload, candidate)) {
            candidate.scopePayload = cached.payload
            candidate.scopeFetchedAt = cached.fetchedAt
            candidate.fromRecovery = true
            return
          }
          if (scopeController.signal.aborted) return
          try {
            candidate.scopePayload = await fetchWorkdayScopePayload({
              candidate, jobsApiUrl, source, session, signal: scopeSignal, requestTimeoutMs,
              retryBaseDelayMs, circuitBreaker: detailCircuitBreaker, requestScheduler,
              countryProof, allowUnresolvedLocations: countryProof && config.retainProvenIndiaOnUnresolvedLocations === true,
            })
            if (countryProof) validateRequiredScopeRole(candidate)
            candidate.scopeFetchedAt = Date.now()
            if (!candidate.unavailableNativeRole && matchesNativeRole(candidate.scopePayload, candidate)) {
              rememberNativeDetailReceipt(nativeDetailRecovery, candidate.receiptKey, candidate.scopePayload, candidate.scopeFetchedAt)
            }
          } catch (error) {
            throwIfAborted(signal)
            if (!scopeController.signal.aborted) throw error
          }
        },
        scopeController,
      )
    } finally { clearTimeout(scopeTimer) }
    const pendingScopeCount = scopeCandidates.filter(candidate => !candidate.scopePayload).length
    if (pendingScopeCount) {
      nativeDetailRecovery.pending += pendingScopeCount
      throw new NativeDetailRecoveryPendingError(pendingScopeCount)
    }
    // In proof mode every receipt is identity-bound before its country can
    // affect another role's secondary office.
    if (countryProof) for (const candidate of scopeCandidates) validateRequiredScopeRole(candidate)
    const countryEvidence = buildWorkdayLocationCountryEvidence(scopeCandidates.filter(candidate => !candidate.unavailableNativeRole))
    for (const candidate of scopeCandidates) {
      validateRequiredScopeRole(candidate)
      if (candidate.unavailableNativeRole) {
        const info = candidate.scopePayload.jobPostingInfo
        candidate.scopeLocations = [resolveWorkdayCxsPrimaryLocation(info), ...(info.additionalLocations || [])]
          .filter(value => typeof value === 'string' && value.trim()).map(value => value.trim())
        candidate.scopeIndiaLocations = []
        candidate.scopeCountryScopes = []
        unresolvedCountryRoles.push({ url: candidate.canonicalLink, requisitionId: info.jobReqId,
          locations: candidate.scopeLocations, reason: candidate.unavailableNativeRole.message,
          code: candidate.unavailableNativeRole.code, nativeStatus: { ...candidate.unavailableNativeRole.nativeStatus } })
        continue
      }
      try {
        const scope = resolveWorkdayScopeLocations(candidate, countryEvidence, source, countryProof, worksiteProof)
        candidate.scopeLocations = scope.locations
        candidate.scopeIndiaLocations = scope.indiaLocations
        candidate.scopeCountryScopes = scope.countryScopes
      } catch (error) {
        if (!countryProof || config.retainProvenIndiaOnUnresolvedLocations !== true
          || error.code !== 'WORKDAY_NATIVE_LOCATIONS_UNRESOLVED') throw error
        const info = candidate.scopePayload.jobPostingInfo
        candidate.scopeLocations = [resolveWorkdayCxsPrimaryLocation(info), ...(info.additionalLocations || [])]
          .filter(value => typeof value === 'string' && value.trim()).map(value => value.trim())
        candidate.scopeIndiaLocations = []
        candidate.scopeCountryScopes = []
        unresolvedCountryRoles.push({ url: candidate.canonicalLink, requisitionId: info.jobReqId,
          locations: candidate.scopeLocations, reason: error.cause.message })
      }
    }

    // Finish listing before optional enrichment so a slow detail page cannot
    // prevent later job IDs from being included in the snapshot.
    // Only the implicit allowance scales with remaining native detail work.
    // Cached required-scope descriptions need no extra requests. Explicit
    // option/config/env budgets, including zero, retain their exact limits.
    const pendingDetailCount = allCandidates.filter(candidate => (
      (!candidate.scopeIndiaLocations || candidate.scopeIndiaLocations.length > 0)
      && !extractWorkdayStructuredDetail(candidate.scopePayload)
    )).length
    const pacedStartIntervalMs = Number.isFinite(requestScheduler?.minIntervalMs)
      ? Math.max(0, requestScheduler.minIntervalMs) : 0
    const allowedDetailBudgetMs = nativeDetailPassBudget(nativeDetailRecovery, detailEnrichmentBudgetMs ?? Math.min(
      MAX_DEFAULT_WORKDAY_DETAIL_ENRICHMENT_BUDGET_MS,
      DEFAULT_WORKDAY_DETAIL_ENRICHMENT_BUDGET_MS + pendingDetailCount * pacedStartIntervalMs,
    ))
    // A full inventory restart does not create a fresh optional-detail budget.
    inventoryRestartState.detailDeadline ??= Date.now() + allowedDetailBudgetMs
    const effectiveDetailBudgetMs = Math.max(0, Math.min(allowedDetailBudgetMs,
      inventoryRestartState.detailDeadline - Date.now()))
    const detailController = new AbortController()
    const budgetError = new Error(`[${source}] Workday detail enrichment budget exhausted`)
    budgetError.name = 'WorkdayDetailBudgetExceededError'
    const detailSignal = signal
      ? AbortSignal.any([signal, detailController.signal])
      : detailController.signal
    const detailBudgetTimer = setTimeout(() => detailController.abort(budgetError), effectiveDetailBudgetMs)
    if (effectiveDetailBudgetMs === 0) detailController.abort(budgetError)

    try {
      const detailedJobs = await mapWithConcurrency(
        allCandidates,
        resolveWorkdayDetailFetchConcurrency(
          process.env.WORKDAY_DETAIL_FETCH_CONCURRENCY,
          config.detailFetchConcurrency,
        ),
        async (candidate) => {
          const { job, canonicalLink, location, scopeLocations, scopeIndiaLocations, scopePayload } = candidate
          throwIfAborted(signal)
          if (scopeIndiaLocations && scopeIndiaLocations.length === 0) return null
          if (scopeLocations && !isWorkdayJobInPublicIndiaScope({ location, locations: scopeLocations })) return null
          const cached = scopePayload || countryProof ? null : readNativeDetailReceipt(nativeDetailRecovery, candidate.receiptKey)
          const cachedPayload = cached && matchesNativeRole(cached.payload, candidate) ? cached.payload : null
          if (cachedPayload) validateNativeRole(cachedPayload, candidate)
          let verifiedNativePayload = scopePayload && matchesNativeRole(scopePayload, candidate) ? scopePayload : cachedPayload
          let verifiedAt = candidate.scopeFetchedAt || (cachedPayload ? cached.fetchedAt : null)
          let fromRecovery = candidate.fromRecovery || Boolean(cachedPayload)
          let detailPayload = extractWorkdayStructuredDetail(scopePayload || cachedPayload)
          if (detailPayload) {
            // The required native scope phase already verified these addresses,
            // including India secondaries whose labels lack a country name.
            if (scopePayload) detailPayload = { ...detailPayload, locations: scopeLocations,
              indiaScopeLocations: scopeIndiaLocations }
          } else if (detailEnrichmentState.disabled || detailController.signal.aborted) {
            detailPayload = createFallbackDetailPayload(detailEnrichmentState.disabled
              ? detailEnrichmentState.failureReason : detailController.signal.reason)
          } else {
            try {
              detailPayload = await fetchDetailedJobPayload(
                canonicalLink,
                source,
                session,
                {
                  signal: detailSignal,
                  requestTimeoutMs,
                  circuitBreaker: detailCircuitBreaker,
                  requestScheduler,
                  jobsApiUrl,
                  nativePayload: scopePayload,
                  validateNativePayload: payload => validateNativeRole(payload, candidate),
                  onNativePayload: payload => {
                    if (matchesNativeRole(payload, candidate)) {
                      verifiedNativePayload = payload
                      verifiedAt = Date.now()
                      rememberNativeDetailReceipt(nativeDetailRecovery, candidate.receiptKey, payload, verifiedAt)
                    }
                  },
                },
              )
            } catch (error) {
              throwIfAborted(signal)
              if (error !== budgetError) throw error
              detailPayload = createFallbackDetailPayload(error)
            }
          }
          // Required scope receipts can carry clocks even when optional
          // description hydration is disabled or has exhausted its budget.
          const nativeClockPayload = scopePayload || cachedPayload || verifiedNativePayload
          if (nativeClockPayload) Object.assign(detailPayload,
            extractWorkdayNativeDateMetadata(nativeClockPayload.jobPostingInfo))
          if (!verifiedNativePayload && detailPayload.sourceDateProvenance) {
            for (const field of ['postingDate', 'closingDate', 'sourceRawDates', 'sourceDateProvenance',
              'postingDatePrecision', 'closingDatePrecision', 'sourcePostingDateIsExact', 'sourceClosingDateIsExact']) delete detailPayload[field]
          }
          maybeDisableWorkdayDetailEnrichment(detailPayload, detailEnrichmentState, source)
          const structuredIndiaLocations = scopeIndiaLocations || detailPayload.indiaScopeLocations
          if (Array.isArray(structuredIndiaLocations) && structuredIndiaLocations.length === 0) return null
          const detailedLocations = structuredIndiaLocations || scopeLocations || resolveWorkdayLocationsFromSummary(location, detailPayload)

          if (!shouldPublishWorkdayListingFallback({ location, detailPayload, locations: detailedLocations })) {
            throw buildWorkdayIncompleteScopeError(source, canonicalLink)
          }

          const indiaScopeLocations = (structuredIndiaLocations || scopeLocations)?.filter((value) => isWorkdayJobInPublicIndiaScope({ location: value }))
          const displayLocation = indiaScopeLocations?.length ? indiaScopeLocations.join(' / ') : location
          const sourceDetailComplete = [detailPayload.sourceDescription, detailPayload.jobDescription]
            .some(value => typeof value === 'string' && value.trim())
          const detailFailureReason = getWorkdayDetailFallbackReason(detailPayload)
          if (nativeDetailRecovery && !sourceDetailComplete) {
            if (detailFailureReason?.name === 'WorkdayDetailBudgetExceededError' && detailEnrichmentBudgetMs !== 0) nativeDetailRecovery.pending++
            else if (detailFailureReason) nativeDetailRecovery.unrecoverable = true
          }
          const postingDate = resolveWorkdayPostingDate(detailPayload.postingDate, job.postedOn)
          const closingDate = parseWorkdayNativeLifecycleDate(detailPayload.sourceRawDates?.endDate, { field: 'endDate' })
          const workdayJob = {
            jobId: extractJobId(canonicalLink) || verifiedNativePayload?.jobPostingInfo.jobReqId.trim() || null,
            title: job.title,
            company,
            department: detailPayload.department,
            location: displayLocation,
            city: indiaScopeLocations?.length ? extractCity(indiaScopeLocations[0]) : detailedLocations[0] || extractCity(location),
            locations: countryProof && scopeLocations ? scopeLocations : detailedLocations,
            ...(countryProof && scopeLocations && { sourceLocationCountryScopes: scopeLocations.map((label, index) => ({
              label, scope: candidate.scopeCountryScopes[index] || 'unknown',
            })) }),
            link: canonicalLink,
            source,
            postedAt: postingDate.date,
            ...(postingDate.raw && { postingDate: postingDate.raw }),
            postingDatePrecision: postingDate.precision,
            sourcePostingDateIsExact: postingDate.exact,
            sourceListingPostedOn: job.postedOn || null,
            closingDate: closingDate.date,
            closingDatePrecision: closingDate.precision,
            sourceClosingDateIsExact: closingDate.exact,
            ...(verifiedNativePayload && detailPayload.sourceDateProvenance && {
              sourceDateProvenance: detailPayload.sourceDateProvenance,
              sourceRawDates: detailPayload.sourceRawDates,
            }),
            jobDescription: detailPayload.jobDescription,
            sourceDetailComplete,
            ...(sourceDetailComplete && nativeDetailRecovery && { sourceDetailVerifiedAt: new Date(verifiedAt || Date.now()).toISOString(),
              ...(fromRecovery && { sourceDetailFromRecovery: true }) }),
            ...(!sourceDetailComplete && { sourceDetailFailureKind:
              detailFailureReason?.name === 'WorkdayDetailBudgetExceededError' ? 'budget-exhausted'
                : detailFailureReason ? 'upstream' : 'missing-content' }),
            ...(detailPayload.sourceDescription && { sourceDescription: detailPayload.sourceDescription }),
            minimumQualification: detailPayload.minimumQualification,
            preferredQualification: detailPayload.preferredQualification,
            requiredSkills: detailPayload.requiredSkills,
            experienceRequired: detailPayload.experienceRequired,
            publicExperienceChecked: detailPayload.publicExperienceChecked,
            requisitionId: detailPayload.requisitionId,
            scrapedAt: new Date().toISOString(),
          }

          if (!isWorkdayJobInPublicIndiaScope(workdayJob)) {
            return null
          }

          return (countryProof || matchesWorkdayLocationPattern(workdayJob, config.locationPattern))
            ? workdayJob
            : null
        },
        detailController,
      )

      allJobs.push(...detailedJobs.filter(Boolean))
    } finally {
      clearTimeout(detailBudgetTimer)
    }

    if (countryProof) {
      const closingInventory = new Map()
      let closingOffset = 0
      let closingTotal = null
      let closingPages = 0
      for (let pageNum = 1; pageNum <= maxPages; pageNum += 1) {
        const payload = await fetchWorkdayJobsApiPage({ jobsApiUrl, bootstrapUrl: searchUrl,
          appliedFacets: {}, searchText: '', offset: closingOffset, source, session, signal,
          requestTimeoutMs, retryBaseDelayMs, circuitBreaker, requestScheduler, requireProofResponse: true })
        closingPages++
        if (closingTotal == null) closingTotal = payload.total
        const pageTotal = pageNum > 1 && payload.total === 0 ? closingTotal : payload.total
        // A changed native inventory can be reacquired, but malformed or
        // cross-board closing rows are contract failures, even if totals drift.
        const apiSite = new URL(jobsApiUrl).pathname.match(/^\/wday\/cxs\/[^/]+\/([^/]+)\/jobs$/)?.[1]
        const closingRows = payload.jobPostings.map(job => {
          const link = typeof job.externalPath === 'string'
            ? buildWorkdayJobDetailUrl(job.externalPath, detailUrlBase, baseUrl) : null
          const rolePath = link && new URL(link).pathname.replace(/^\/[a-z]{2}-[a-z]{2}(?=\/)/i, '')
          if (typeof job.title !== 'string' || !job.title.trim()
            || typeof job.externalPath !== 'string' || !/^\/job\/.*_[^/]+$/.test(job.externalPath)
            || !apiSite || !link || rolePath !== '/' + apiSite + job.externalPath) {
            throw buildWorkdayIncompleteListingError(source, 'closing complete-board role identity is malformed or outside this board')
          }
          return { link, identity: workdayInventoryIdentity(job) }
        })
        if (pageTotal !== reportedTotal || pageTotal !== closingTotal) {
          throw Object.assign(buildWorkdayInventoryChangedError(source, 'closing complete-board count changed'),
            { inventoryPhase: 'closing', [WORKDAY_CLOSING_INVENTORY_CHANGED]: true })
        }
        for (const { link, identity } of closingRows) {
          if (closingInventory.has(link) || initialInventory.get(link) !== identity) {
            throw Object.assign(buildWorkdayInventoryChangedError(source, 'closing complete-board role identity changed or repeated'),
              { inventoryPhase: 'closing', [WORKDAY_CLOSING_INVENTORY_CHANGED]: true })
          }
          closingInventory.set(link, identity)
        }
        closingOffset += payload.jobPostings.length
        if (closingOffset >= closingTotal) break
        if (!payload.jobPostings.length || pageNum === maxPages) {
          throw buildWorkdayIncompleteListingError(source, 'closing complete-board inventory was truncated')
        }
      }
      if (initialInventory.size !== reportedTotal || closingInventory.size !== reportedTotal) {
        throw buildWorkdayIncompleteListingError(source, 'initial and closing complete-board role sets do not reconcile')
      }
      const identities = [...initialInventory.values()].sort()
      Object.defineProperty(allJobs, WORKDAY_COUNTRY_INVENTORY_PROOF, { value: {
        scope: 'complete-board-country-proof', boardReceipt, unresolvedRoles: unresolvedCountryRoles,
        initial: { reportedTotal, count: initialInventory.size, sha256: hashWorkdayProof(JSON.stringify(identities)) },
        closing: { reportedTotal: closingTotal, count: closingInventory.size,
          sha256: hashWorkdayProof(JSON.stringify([...closingInventory.values()].sort())), verifiedAt: new Date().toISOString() },
        listingRoles: [...initialInventory].map(([url, identity]) => {
          const [externalPath, title, bulletFields, locationsText] = JSON.parse(identity)
          return { url, externalPath, title, bulletFields, locationsText }
        }),
        roles: scopeCandidates.map(candidate => ({ url: candidate.canonicalLink,
          requisitionId: candidate.scopePayload.jobPostingInfo.jobReqId,
          locations: candidate.scopeLocations, countryScopes: candidate.scopeCountryScopes })),
      } })
      pagesFetched += closingPages
    }
    if (worksiteProof) Object.defineProperty(allJobs, WORKDAY_ADDITIONAL_WORKSITE_PROOF, { value: {
      source, directoryUrl: worksiteProof.directoryUrl, corporateReceipt: worksiteProof.corporateReceipt,
      snapshots: worksiteProof.snapshots, verifiedAt: worksiteProof.verifiedAt,
      roles: scopeCandidates.map(candidate => ({ url: candidate.canonicalLink,
        requisitionId: candidate.scopePayload.jobPostingInfo.jobReqId,
        nativePayload: structuredClone(candidate.scopePayload),
        additionalWorksiteCountryBindings: candidate.additionalWorksiteCountryBindings || [] })),
    } })
    if (unresolvedCountryRoles.length) for (const job of allJobs) Object.assign(job, {
      sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false,
      sourceUnresolvedCountryRoleCount: unresolvedCountryRoles.length,
    })
    return attachInventoryEvidence(allJobs, {
      status: unresolvedCountryRoles.length ? 'coverage-gap' : 'complete-inventory',
      surface: jobsApiUrl,
      firstParty: true,
      listingComplete: unresolvedCountryRoles.length === 0,
      pagesFetched,
      reportedTotal,
      indiaFacetCount: unresolvedCountryRoles.length ? null : allJobs.length,
      verifiedAt: new Date(countryProof ? Date.now() : nativeDetailRecovery?.verifiedAt || Date.now()).toISOString(),
      reason: unresolvedCountryRoles.length ? `reconciled-workday-board;unresolved-country-roles=${unresolvedCountryRoles.length};proven-india-roles-only`
        : countryProof ? 'reconciled-complete-workday-board-country-proof' : 'complete-workday-india-enumeration',
    })
  } finally {
    throwIfAborted(signal)
  }
}

const runWorkdayJobsApiScraper = async options => {
  const inventoryRestartState = { used: false, detailDeadline: null }
  try {
    return await runWorkdayJobsApiPass({ ...options, inventoryRestartState })
  } catch (error) {
    throwIfAborted(options.signal)
    if (inventoryRestartState.used || error.code !== 'WORKDAY_INVENTORY_CHANGED'
      || error[WORKDAY_CLOSING_INVENTORY_CHANGED] !== true) throw error
    inventoryRestartState.used = true
    // Discard all first-pass jobs, details and proof. A new pass must reacquire
    // corporate binding, bootstrap, the complete listing and closing inventory.
    // The original caller deadline, pacing and detail deadline remain in force.
    console.log(`  [${options.source}] Workday closing inventory changed; restarting the complete pass once.`)
    return runWorkdayJobsApiPass({ ...options, inventoryRestartState })
  }
}

// Executes the fetch-only public API pipeline for any target Workday site.
export const runWorkdayScraper = async (options) => {
  const { company, baseUrl, locationCountry, source, scraperDir } = options
  const signal = options.signal || null
  const nativeDetailRecovery = options.nativeDetailRecovery ?? currentNativeDetailRecovery()
  const config = loadConfig(scraperDir)
  const envRequestTimeoutMs = Number.parseInt(process.env.WORKDAY_REQUEST_TIMEOUT_MS, 10)
  const requestTimeoutMs = [
    Number(options.requestTimeoutMs),
    Number(config.requestTimeoutMs),
    envRequestTimeoutMs,
  ].find((value) => Number.isFinite(value) && value > 0)
    || DEFAULT_WORKDAY_REQUEST_TIMEOUT_MS
  const retryBaseDelayMs = [
    Number(options.retryBaseDelayMs),
    Number(config.retryBaseDelayMs),
  ].find((value) => Number.isFinite(value) && value >= 0)
    ?? WORKDAY_JOBS_API_RETRY_BASE_DELAY_MS
  const requestScheduler = options.requestScheduler || workdayRequestScheduler
  const circuitBreaker = options.circuitBreaker || workdayHostCircuitBreaker
  const detailCircuitBreaker = options.detailCircuitBreaker || new WorkdayHostCircuitBreaker()
  const detailEnrichmentState = options.detailEnrichmentState || { disabled: false, noticeLogged: false }
  const detailEnrichmentBudgetMs = [
    options.detailEnrichmentBudgetMs,
    config.detailEnrichmentBudgetMs,
    process.env.WORKDAY_DETAIL_ENRICHMENT_BUDGET_MS,
  ].filter((value) => value != null && value !== '')
    .map(Number)
    .find((value) => Number.isFinite(value) && value >= 0)
    ?? null
  throwIfAborted(signal)

  const countryId = config.inventoryScope === 'complete-board-country-proof' ? null : Object.prototype.hasOwnProperty.call(config, 'locationCountry')
    ? config.locationCountry
    : (locationCountry || 'c4f78be1a8f14da0ab49ce1162348a5e')
  const inferredApiConfig = inferWorkdayJobsApiConfig(baseUrl)
  const hasExplicitJobsApiConfig = config.listingStrategy === 'jobs-api'

  if (hasExplicitJobsApiConfig) {
    try {
      return await runWorkdayJobsApiScraper({
        company,
        baseUrl,
        locationCountry: countryId,
        source,
        config,
        boardIdentityVerified: options.boardIdentityVerified === true,
        signal,
        requestTimeoutMs,
        retryBaseDelayMs,
        circuitBreaker,
        requestScheduler,
        detailCircuitBreaker,
        detailEnrichmentState,
        detailEnrichmentBudgetMs,
        nativeDetailRecovery,
        sourceWorksiteCountryProof: options.sourceWorksiteCountryProof,
      })
    } catch (error) {
      throwIfAborted(signal)
      throw markWorkdayTerminalFailure(error)
    }
  }

  if (!hasExplicitJobsApiConfig && inferredApiConfig) {
    try {
      return await runWorkdayJobsApiScraper({
        company,
        baseUrl,
        locationCountry: countryId,
        source,
        config: {
          ...config,
          ...inferredApiConfig,
          listingStrategy: 'jobs-api',
        },
        boardIdentityVerified: options.boardIdentityVerified === true,
        signal,
        requestTimeoutMs,
        retryBaseDelayMs,
        circuitBreaker,
        requestScheduler,
        detailCircuitBreaker,
        detailEnrichmentState,
        detailEnrichmentBudgetMs,
        nativeDetailRecovery,
        sourceWorksiteCountryProof: options.sourceWorksiteCountryProof,
      })
    } catch (error) {
      throwIfAborted(signal)
      throw markWorkdayTerminalFailure(error)
    }
  }

  throw markWorkdayTerminalFailure(
    new Error(`[${source}] API-only Workday scraper could not infer a public Workday jobs API from ${baseUrl}`),
  )

}
