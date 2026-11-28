import { buildHttpError, isHttpAccessChallenge, parseRetryAfterHeader } from '../utils/fetch.js'
import { disposeResponseBody } from '../shared/responseBodyDisposal.js'
import { hasWorkdayOutageSignal, WorkdayUpstreamOutageError } from './engine.js'
import { workdayRequestScheduler } from './requestScheduler.js'

const PAGE_ATTEMPTS = 3
const RATE_LIMIT_DELAY_MS = 5000
const RETRY_BASE_DELAY_MS = 1000
const BROWSER_CHALLENGE_HTML = /<title[^>]*>\s*(?:just a moment|access denied|attention required|robot check|radware captcha page)|\/cdn-cgi\/challenge-platform\/|<(?:h1|p)\b[^>]*>\s*(?:captcha challenge|verify you are human)/i
const ownedHttpFailures = new WeakSet()

const pageHttpFailure = (response, url) => {
  const error = buildHttpError(response, url)
  ownedHttpFailures.add(error)
  return error
}

const pageAccessChallenge = (response, url, source) => Object.assign(pageHttpFailure(response, url), {
  message: `[${source}] Workday access challenge returned HTTP_${response.status} at ${url}`,
  accessChallenge: true,
  abortRetries: true,
  softFailure: true,
  upstreamOutage: true,
  failureKind: 'blocked_or_access_denied',
  lifecycleCleanupAllowed: false,
  sourceScopeComplete: false,
})

const fetchPageAttempt = async (url, {
  signal,
  source,
  headers,
  timeoutMs,
  fetchImpl,
  requestScheduler,
}, attempt) => {
  signal?.throwIfAborted()
  const release = await requestScheduler.acquire(url, { signal, kind: 'listing' })
  const controller = new AbortController()
  const forwardAbort = () => controller.abort(signal.reason)
  if (signal?.aborted) forwardAbort()
  signal?.addEventListener('abort', forwardAbort, { once: true })
  const timeout = setTimeout(() => controller.abort(
    Object.assign(new Error(`[${source}] Workday request timed out after ${timeoutMs}ms at ${url}`), {
      name: 'WorkdayRequestTimeoutError', softFailure: true, upstreamOutage: true,
      failureKind: 'network_or_timeout', requestTimeoutMs: timeoutMs,
    }),
  ), timeoutMs)
  let response, observedFailure, disposal
  const dispose = () => disposal ||= disposeResponseBody(response, { bestEffort: true }).catch(() => {})
  try {
    controller.signal.throwIfAborted()
    response = await fetchImpl(url, { headers, redirect: 'follow', signal: controller.signal })
    controller.signal.throwIfAborted()

    if (isHttpAccessChallenge(response)) {
      observedFailure = pageAccessChallenge(response, url, source)
      throw observedFailure
    }

    if (response.status < 200 || response.status >= 300) observedFailure = pageHttpFailure(response, url)
    if (response.status === 429 || response.status === 503) {
      const serverDelay = parseRetryAfterHeader(response.headers?.get?.('retry-after'))
      const retryDelayMs = Math.max(
        RETRY_BASE_DELAY_MS * (2 ** (attempt - 1)),
        serverDelay ?? (response.status === 429 ? RATE_LIMIT_DELAY_MS : 0),
      )
      observedFailure.retryDelayMs = retryDelayMs
      // The next attempt and peer tenants use the same shard cooldown.
      requestScheduler.recordRateLimit(url, retryDelayMs)
    } else if (observedFailure) {
      // Access denials and unsupported statuses never trigger a second page read.
      throw observedFailure
    }

    const page = {
      status: response.status,
      url: response.url,
      html: await response.text(),
      headers: response.headers,
      contentType: response.headers?.get?.('content-type'),
    }
    controller.signal.throwIfAborted()
    if (BROWSER_CHALLENGE_HTML.test(page.html)) {
      observedFailure = pageAccessChallenge(response, url, source)
      throw observedFailure
    }
    if (hasWorkdayOutageSignal(page)) {
      observedFailure = new WorkdayUpstreamOutageError(
        `[${source}] Workday is currently unavailable upstream at ${page.url || url}`,
      )
      throw observedFailure
    }
    if (observedFailure) throw observedFailure
    return page
  } catch (error) {
    if (response) await dispose()
    // A caller owns its exact cancellation reason, including opaque values.
    signal?.throwIfAborted()
    // An interrupted error body must not erase its observed HTTP status.
    throw observedFailure || (controller.signal.aborted ? controller.signal.reason : error)
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', forwardAbort)
    release()
  }
}

export const fetchWorkdayPage = async (url, {
  signal,
  source = 'workday',
  headers,
  timeoutMs = 15000,
  fetchImpl = fetch,
  requestScheduler = workdayRequestScheduler,
} = {}) => {
  for (let attempt = 1; attempt <= PAGE_ATTEMPTS; attempt += 1) {
    try {
      return await fetchPageAttempt(url, {
        signal, source, headers, timeoutMs, fetchImpl, requestScheduler,
      }, attempt)
    } catch (error) {
      signal?.throwIfAborted()
      // Only page HTTP failures belong to this retry loop. Transport rejections
      // stay opaque and retain the source runner's existing retry policy.
      if (!ownedHttpFailures.has(error) || error.accessChallenge) throw error
      const status = Number(error?.httpStatus)
      if ((status === 429 || status === 503) && error.abortRetries !== true && attempt < PAGE_ATTEMPTS) continue
      if (status === 429 || status === 503 || status === 403) {
        Object.assign(error, {
          abortRetries: true,
          softFailure: true,
          upstreamOutage: true,
          failureKind: status === 503 ? 'network_or_timeout' : 'blocked_or_access_denied',
          lifecycleCleanupAllowed: false,
          sourceScopeComplete: false,
        })
      }
      throw error
    }
  }
}
