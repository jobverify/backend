import { createHash } from 'node:crypto'
import { parseExpressionAt } from 'acorn'
import { buildHttpError, parseRetryAfterHeader } from '../../scraper-support/utils/fetch.js'

const assertNativeJSON = text => {
  const value = JSON.parse(text)
  const visit = node => {
    if (!node || typeof node !== 'object') return
    if (node.type === 'ObjectExpression') {
      const keys = new Set()
      for (const field of node.properties) {
        const key = field.key.value ?? field.key.name
        if (keys.has(key)) throw new Error('Green Dot native JSON has duplicate supplied fields')
        keys.add(key)
      }
    }
    for (const child of Object.values(node)) if (Array.isArray(child)) child.forEach(visit); else if (child && typeof child === 'object') visit(child)
  }
  visit(parseExpressionAt(text, 0, { ecmaVersion: 'latest' }))
  const failed = object => object && typeof object === 'object' && !Array.isArray(object) && Object.entries(object).some(([key, field]) => {
    const name = key.toLowerCase().replace(/[_\s-]/g, '')
    if (['error', 'errors', 'errorcode', 'errormessage', 'exception', 'fault'].includes(name)) return true
    if (name === 'success') return field !== true
    if (['status', 'statuscode', 'httpstatus', 'httpstatuscode'].includes(name) && typeof field !== 'object') return !['200', 'ok', 'success', 'successful'].includes(String(field).toLowerCase())
    return ['meta', 'metadata', 'result', 'response'].includes(name) && failed(field)
  })
  if (!value || typeof value !== 'object' || Array.isArray(value) || failed(value)) throw new Error('Green Dot native unsupported/error JSON envelope')
  return value
}

export class GreendotNativeRequestTimeoutError extends Error {
  constructor(url, timeoutMs) { super(`Green Dot native request exceeded ${timeoutMs}ms: ${url}`); this.name = 'GreendotNativeRequestTimeoutError' }
}
export const isGreendotDeadline = error => ['GreendotNativeRequestTimeoutError', 'WorkdayRequestTimeoutError', 'TimeoutError'].includes(error?.name)

// The caller owns scheduler/admission until all underlying reads settle. Do not
// detach a signal-ignoring fetch/body promise with an abort-race wrapper.
export const createGreendotNativeBoundary = ({ fetchImpl, requestScheduler, now, requestTimeoutMs = 20000 }) => {
  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs <= 0 || requestTimeoutMs > 20000) throw new RangeError('Invalid Green Dot native request deadline')
  return async (url, { signal, method = 'GET', body, html = false, session, onStop } = {}) => {
    signal?.throwIfAborted()
    const controller = new AbortController(), deadline = new GreendotNativeRequestTimeoutError(url, requestTimeoutMs)
    const boundarySignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
    const timer = setTimeout(() => controller.abort(deadline), requestTimeoutMs)
    let release, reader, httpError
    const capture = { url, method, requestBody: body ?? null, startedAt: now(), responseUrl: null, status: null }
    const check = () => { signal?.throwIfAborted(); boundarySignal.throwIfAborted() }
    try {
      release = await requestScheduler.acquire(url, { signal: boundarySignal, kind: method === 'POST' ? 'listing' : 'detail' })
      check()
      const response = await fetchImpl(url, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: 'manual', signal: boundarySignal,
        headers: { Accept: html ? 'text/html,application/xhtml+xml' : 'application/json', 'Content-Type': 'application/json', 'Accept-Language': 'en-US', 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)',
          ...(session?.token ? { 'X-CALYPSO-CSRF-TOKEN': session.token } : {}), ...(session?.cookie ? { Cookie: session.cookie } : {}) } })
      reader = response.body?.getReader()
      capture.status = response.status; capture.responseUrl = response.url
      capture.headers = Object.fromEntries(response.headers)
      check()
      if (response.status !== 200) {
        httpError = buildHttpError(response, url)
        const retryAfter = response.headers.get('retry-after')
        if (retryAfter != null) httpError.retryAfter = retryAfter
        if (response.status === 429) {
          const delay = parseRetryAfterHeader(retryAfter, +new Date(now()))
          if (delay != null) httpError.retryDelayMs = delay
          requestScheduler.recordRateLimit?.(url, httpError.retryDelayMs ?? 5000)
        }
        httpError.nativeCapture = capture
        if ([401, 403, 429].includes(response.status)) {
          httpError.abortRetries = true
          // Stop peers at headers while this actual bounded body is consumed
          // and settled. Its caller/own deadline still has exact priority.
          onStop?.(httpError)
        }
      }
      const chunks = []
      let size = 0
      while (reader) {
        const next = await reader.read()
        check()
        if (next.done) break
        size += next.value.byteLength
        if (size > 2 * 1024 * 1024) throw new Error('Green Dot native body exceeds2MiB')
        chunks.push(Buffer.from(next.value))
      }
      check()
      const bytes = Buffer.concat(chunks)
      capture.rawText = bytes.toString('utf8'); capture.bytes = bytes.length
      capture.sha256 = createHash('sha256').update(bytes).digest('hex'); capture.completedAt = now()
      if (httpError) throw httpError
      if (response.url !== url) throw new Error('Green Dot native exact response URL mismatch')
      const contentType = response.headers.get('content-type') || ''
      if (!(html ? /^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i : /^application\/json(?:;|$)/i).test(contentType)) throw new Error('Green Dot native content type mismatch')
      if (html) return capture
      const payload = assertNativeJSON(capture.rawText)
      return { ...capture, payload }
    } catch (error) {
      // Exact caller cause takes priority over body replacement and own timeout.
      if (signal?.aborted) throw signal.reason
      if (boundarySignal.aborted) throw boundarySignal.reason
      const failure = httpError || new Error(error.message, { cause: error })
      if (httpError && error !== httpError) httpError.cause = error
      failure.nativeCapture = capture
      throw failure
    } finally {
      await reader?.cancel().catch(() => {})
      clearTimeout(timer)
      release?.()
      signal?.throwIfAborted()
      boundarySignal.throwIfAborted()
    }
  }
}
