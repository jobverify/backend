import { traceRetryPressure, recordRetryAttempt, recordRetryFailure, recordRetryDelay } from './retryPressure.js'
export { getRetryPressure } from './retryPressure.js'

const resolveAbortReason = (signal) => {
  if (signal?.reason !== undefined) {
    return signal.reason
  }

  const error = new Error('The operation was aborted')
  error.name = 'AbortError'
  return error
}

const RETRY_METADATA = Symbol('jobverify.retryMetadata')

const PERMANENT_LOCAL_ERROR_CODES = new Set([
  'ENOENT', 'ENOTDIR', 'EACCES', 'ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND',
  'SCRAPER_RUNTIME_ASSET_INVALID',
])

const isPermanentLocalError = error => {
  const visited = new Set()
  for (let current = error; current && !visited.has(current); current = current.cause) {
    visited.add(current)
    if (PERMANENT_LOCAL_ERROR_CODES.has(current.code)) return true
  }
  return false
}

const PERMANENT_CERTIFICATE_ERROR_CODES = new Set([
  'CERT_HAS_EXPIRED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
])

const isPermanentCertificateError = (error) => {
  const visited = new Set()
  let current = error

  while (current && !visited.has(current)) {
    visited.add(current)
    if (PERMANENT_CERTIFICATE_ERROR_CODES.has(current.code)) return true
    current = current.cause
  }

  return false
}

export const getRetryMetadata = (value) => value?.[RETRY_METADATA] || {
  attemptsUsed: 1,
  retries: 0,
  retryDelayMs: 0,
}

const attachRetryMetadata = (value, metadata) => {
  if (value == null || (typeof value !== 'object' && typeof value !== 'function')) return value
  Object.defineProperty(value, RETRY_METADATA, {
    configurable: true,
    value: metadata,
  })
  return value
}

const throwIfAborted = (signal) => {
  if (signal?.aborted) {
    throw resolveAbortReason(signal)
  }
}

const sleep = (ms, { signal } = {}) => {
  if (!signal) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  if (signal.aborted) {
    return Promise.reject(resolveAbortReason(signal))
  }

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      reject(resolveAbortReason(signal))
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    signal.addEventListener('abort', onAbort, { once: true })
  })
}

const collectErrorMessages = (error) => {
  const messages = []
  const visited = new Set()
  let current = error

  while (current && !visited.has(current)) {
    visited.add(current)

    const message = typeof current?.message === 'string'
      ? current.message.trim()
      : String(current ?? '').trim()
    const code = typeof current?.code === 'string' ? current.code.trim() : ''

    if (message) {
      messages.push(message)
    } else if (code) {
      messages.push(code)
    }

    current = current?.cause
  }

  return [...new Set(messages.filter(Boolean))]
}

const describeError = (error) => collectErrorMessages(error).join(' | ') || String(error ?? '')

const resolveErrorCode = (error) => {
  const visited = new Set()
  let current = error

  while (current && !visited.has(current)) {
    visited.add(current)

    if (typeof current?.code === 'string' && current.code.trim()) {
      return current.code.trim()
    }

    current = current?.cause
  }

  return undefined
}

const resolveRetryDelayMs = (error) => {
  const visited = new Set()
  let current = error

  while (current && !visited.has(current)) {
    visited.add(current)

    const retryDelayMs = Number(current?.retryDelayMs)
    if (Number.isFinite(retryDelayMs) && retryDelayMs >= 0) {
      return retryDelayMs
    }

    current = current?.cause
  }

  return undefined
}

const buildRetryError = (
  label,
  attemptsUsed,
  attemptsAllowed,
  lastError,
  { aborted = false, retryDelayMs = 0 } = {},
) => {
  const lastErrorSummary = describeError(lastError)
  const message = aborted
    ? `[${label}] Retry aborted after attempt ${attemptsUsed}/${attemptsAllowed}. Last error: ${lastErrorSummary}`
    : `[${label}] All ${attemptsUsed} attempts failed. Last error: ${lastErrorSummary}`
  const finalErr = new Error(message)

  finalErr.cause = lastError

  for (const key of ['softFailure', 'upstreamOutage', 'failureKind', 'abortRetries', 'localTimeout', 'retryDelayMs', 'partial']) {
    if (lastError?.[key] != null) {
      finalErr[key] = lastError[key]
    }
  }

  if (aborted) finalErr.abortRetries = true

  const resolvedCode = resolveErrorCode(lastError)
  if (resolvedCode) {
    finalErr.code = resolvedCode
  }

  return attachRetryMetadata(finalErr, { attemptsUsed, retries: attemptsUsed - 1, retryDelayMs })
}

/**
 * Wraps an async function with exponential backoff retry logic.
 *
 * On each failure the delay doubles:
 *   attempt 1 fails -> wait baseDelayMs        (e.g. 2s)
 *   attempt 2 fails -> wait baseDelayMs x 2    (e.g. 4s)
 *   attempt 3 fails -> wait baseDelayMs x 4    (e.g. 8s)
 *   attempt 4 -> throws final error
 *
 * @param {Function} fn          Async function to execute
 * @param {object}   opts
 * @param {number}   opts.attempts      Max total attempts (default 3)
 * @param {number}   opts.baseDelayMs   Initial delay in ms (default 2000)
 * @param {string}   opts.label         Identifier for log messages (e.g. scraper name)
 * @param {AbortSignal} opts.signal      Optional caller cancellation signal
 * @returns {Promise<*>} Result of fn() on success
 * @throws {Error} After all attempts are exhausted
 */
const runRetryLoop = async (
  fn,
  {
    attempts = 3,
    baseDelayMs = 2000,
    label = 'task',
    signal,
  } = {},
) => {
  let lastError
  let retryDelayMs = 0

  for (let attempt = 1; attempt <= attempts; attempt++) {
    throwIfAborted(signal)
    recordRetryAttempt(attempt)

    try {
      const result = await fn()
      throwIfAborted(signal)
      return attachRetryMetadata(result, {
        attemptsUsed: attempt,
        retries: attempt - 1,
        retryDelayMs,
      })
    } catch (err) {
      recordRetryFailure()
      throwIfAborted(signal)
      lastError = err
      const isLastAttempt = attempt === attempts

      console.warn(`\n  [retry:${label}] Attempt ${attempt}/${attempts} failed`)
      console.warn(`  [retry:${label}] Error: ${describeError(err)}`)

      if (err?.abortRetries === true || err?.failureKind === 'parser_or_contract_error' || isPermanentCertificateError(err) || isPermanentLocalError(err)) {
        throw buildRetryError(label, attempt, attempts, err, { aborted: true, retryDelayMs })
      }

      if (!isLastAttempt) {
        const delay = Math.max(
          baseDelayMs * Math.pow(2, attempt - 1),
          resolveRetryDelayMs(err) || 0,
        )
        console.warn(`  [retry:${label}] Retrying in ${(delay / 1000).toFixed(1)}s...\n`)
        retryDelayMs += delay
        recordRetryDelay(delay)
        await sleep(delay, { signal })
      }
    }
  }

  throw buildRetryError(label, attempts, attempts, lastError, { retryDelayMs })
}

export const withRetry = (fn, options) => traceRetryPressure(() => runRetryLoop(fn, options))
