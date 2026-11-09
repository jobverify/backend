import { setTimeout as delay } from 'node:timers/promises'
import { extractPhAppDdo } from '../../scraper-support/phenom/engine.js'
import { fetchTextWithRetry, parseRetryAfterHeader } from '../../scraper-support/utils/fetch.js'

const SOURCE_ORIGIN = 'https://jobs.thermofisher.com'
const DEFAULT_NATIVE_BACKOFF_MS = 30000
const MAX_NATIVE_RETRIES = 2
const MAX_NATIVE_WAIT_MS = 60000
const MAX_NATIVE_ERROR_BYTES = 512 * 1024
// Only failed HTTP410 bodies use this reader. The shared fetcher consumes no
// error body afterward, so inspect the original stream with a real byte bound.
const readNativeErrorBody = async (response, signal) => {
  if (!response.body) return null
  const reader = response.body.getReader(), chunks = []
  let bytes = 0
  try {
    while (true) {
      signal?.throwIfAborted()
      const { done, value } = await reader.read()
      signal?.throwIfAborted()
      if (done) return Buffer.concat(chunks, bytes).toString('utf8')
      bytes += value.byteLength
      if (bytes > MAX_NATIVE_ERROR_BYTES) {
        await reader.cancel()
        signal?.throwIfAborted()
        return null
      }
      chunks.push(Buffer.from(value))
    }
  } finally { reader.releaseLock() }
}
const sleepWithSignal = async (ms, { signal } = {}) => {
  try { await delay(ms, undefined, { signal }) }
  finally { signal?.throwIfAborted() }
}

// This public site sometimes returns HTTP410 with an explicit native WS429.
// A real closed job, ordinary HTTP error or absent body never qualifies.
export const createThermoFisherFetchText = ({ fetchImpl = fetch, sleep = sleepWithSignal, config = {} } = {}) => async (url, { signal } = {}) => {
  const requested = new URL(url)
  const ownedDetail = requested.origin === SOURCE_ORIGIN && !requested.username && !requested.password
    && !requested.search && !requested.hash && /^\/global\/en\/job\/[^/]+\/[^/]+$/.test(requested.pathname)
  let retries = 0, waitedMs = 0
  while (true) {
    signal?.throwIfAborted()
    let nativeThrottle = null
    try {
      return await fetchTextWithRetry(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        attempts: config.retryAttempts || 1,
        baseDelayMs: config.retryBaseDelayMs || 1000,
        timeoutMs: config.fetchTimeoutMs || 15000,
        label: 'thermofisherscientific', signal,
        fetchImpl: async (requestUrl, init) => {
          const response = await fetchImpl(requestUrl, init)
          if (ownedDetail && response.status === 410 && response.url === String(url)
            && /^(?:text\/html|application\/xhtml\+xml)(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) {
            const body = await readNativeErrorBody(response, init.signal)
            init.signal?.throwIfAborted()
            if (body !== null) {
              const native = extractPhAppDdo(body)?.jobDetail
              if (native?.status === 429 && native.error === 'Error in WS call'
                && Object.keys(native).every(key => ['status', 'error'].includes(key))) {
                nativeThrottle = { retryAfterMs: parseRetryAfterHeader(response.headers.get('retry-after')) }
              }
            }
          }
          return response
        },
      })
    } catch (error) {
      signal?.throwIfAborted()
      const waitMs = Math.max(DEFAULT_NATIVE_BACKOFF_MS, nativeThrottle?.retryAfterMs ?? 0)
      // A longer Retry-After holds this role rather than making an early retry.
      if (!nativeThrottle || retries >= MAX_NATIVE_RETRIES || waitedMs + waitMs > MAX_NATIVE_WAIT_MS) throw error
      retries++
      waitedMs += waitMs
      await sleep(waitMs, { signal })
      signal?.throwIfAborted()
    }
  }
}
