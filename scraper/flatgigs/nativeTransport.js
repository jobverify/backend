import { createHash } from 'node:crypto'
import { composeAbortSignals, buildHttpError } from '../../scraper-support/utils/fetch.js'
import { ALLOWED_URLS, CAREERS_URL, EMBED_URL, CLIENT_URL, iso, failure, need } from './nativeContract.js'

const clock = () => new Date().toISOString()
const abortable = (operation, signal) => new Promise((resolve, reject) => {
  const cleanup = () => signal.removeEventListener('abort', abort)
  const abort = () => { cleanup(); reject(signal.reason) }
  signal.addEventListener('abort', abort, { once: true })
  if (signal.aborted) { abort(); Promise.resolve(operation).catch(() => {}); return }
  Promise.resolve(operation).then(value => { cleanup(); resolve(value) }, error => { cleanup(); reject(error) })
})

// Injected retained packets use the same bounded caller/deadline contract. They
// are evidence inputs, never a freshness or availability attestation.
export const readEvidencePacket = async (read, url, { signal, requestTimeoutMs = 20000 } = {}) => {
  signal?.throwIfAborted()
  need(ALLOWED_URLS.has(url) && typeof read === 'function' && Number.isInteger(requestTimeoutMs) && requestTimeoutMs > 0 && requestTimeoutMs <= 20000, 'invalid native evidence request')
  const own = new AbortController(), deadline = failure('native evidence request deadline exceeded', { name: 'TimeoutError', code: 'native_timeout' })
  const timer = setTimeout(() => own.abort(deadline), requestTimeoutMs), attempt = composeAbortSignals(signal, own.signal)
  const check = () => { signal?.throwIfAborted(); own.signal.throwIfAborted() }
  try { const packet = await abortable(read(url, { method: 'GET', signal: attempt }), attempt); check(); return packet }
  catch (error) { check(); throw error }
  finally { clearTimeout(timer) }
}

export const fetchNativePacket = async (url, {
  signal, fetchImpl = globalThis.fetch, requestTimeoutMs = 20000,
  maximumBytes = 8 * 1024 * 1024, captureClock = clock,
} = {}) => {
  signal?.throwIfAborted()
  need(ALLOWED_URLS.has(url), 'unadvertised native request URL')
  need(typeof fetchImpl === 'function' && Number.isInteger(requestTimeoutMs) && requestTimeoutMs > 0 && requestTimeoutMs <= 20000, 'invalid native transport/deadline')
  need(Number.isInteger(maximumBytes) && maximumBytes > 0 && maximumBytes <= 8 * 1024 * 1024 && typeof captureClock === 'function', 'invalid native byte or clock budget')
  const own = new AbortController(), deadline = failure('native request deadline exceeded', { name: 'TimeoutError', code: 'native_timeout' })
  const timer = setTimeout(() => own.abort(deadline), requestTimeoutMs), attempt = composeAbortSignals(signal, own.signal)
  const checkAbort = () => { signal?.throwIfAborted(); own.signal.throwIfAborted() }
  const reason = () => signal?.aborted ? signal.reason : own.signal.aborted ? own.signal.reason : attempt.reason
  let response, reader, cancelled = false
  const cancel = value => {
    if (cancelled || !reader && !response?.body) return
    cancelled = true
    try { Promise.resolve(reader ? reader.cancel(value) : response.body.cancel(value)).catch(() => {}) } catch {}
  }
  let startedAt = null
  try {
    startedAt = iso(captureClock('startedAt', url))
    const pending = Promise.resolve(fetchImpl(url, { method: 'GET', redirect: 'manual', signal: attempt, headers: { 'User-Agent': 'Mozilla/5.0', Accept: url === CAREERS_URL || url === EMBED_URL ? 'text/html' : 'application/javascript' } })).then(value => {
      response = value
      if (attempt.aborted) cancel(reason())
      return value
    })
    response = await abortable(pending, attempt); checkAbort()
    const expected = url === EMBED_URL ? 302 : 200
    if (response.status !== expected) {
      const cause = buildHttpError(response, url)
      throw failure('native HTTP ' + response.status, { status: response.status, code: [401, 403].includes(response.status) ? 'access_denied' : response.status === 429 ? 'rate_limited' : 'native_unavailable', cause })
    }
    need(response.url === url && response.redirected !== true, 'unexpected native final URL or automatic redirect')
    const contentType = response.headers?.get('content-type') || '', redirectLocation = response.headers?.get('location') || null
    if (url === EMBED_URL) need(redirectLocation === CLIENT_URL, 'unadvertised native client redirect')
    else need(!redirectLocation, 'unexpected native redirect header')
    need(url === CAREERS_URL || url === EMBED_URL ? /^text\/html(?:\s*;|$)/i.test(contentType) : /^(?:application|text)\/javascript(?:\s*;|$)/i.test(contentType), 'unsupported native content type')
    const declaredLength = response.headers?.get('content-length')
    need(declaredLength == null || /^\d+$/.test(declaredLength) && Number(declaredLength) <= maximumBytes, 'oversized or invalid native content length')
    need(response.body?.getReader, 'missing native response body')
    reader = response.body.getReader()
    const chunks = []; let bytes = 0
    for (;;) {
      const chunk = await abortable(reader.read(), attempt); checkAbort()
      if (chunk.done) break
      need(chunk.value instanceof Uint8Array, 'unsupported native body chunk')
      bytes += chunk.value.byteLength; need(bytes <= maximumBytes, 'oversized streamed native body')
      chunks.push(Buffer.from(chunk.value))
    }
    const raw = Buffer.concat(chunks), encoding = (response.headers?.get('content-encoding') || '').trim().toLowerCase()
    need(declaredLength == null || encoding && encoding !== 'identity' || bytes === Number(declaredLength), 'native identity body Content-Length mismatch')
    const body = new TextDecoder('utf-8', { fatal: true }).decode(raw)
    checkAbort()
    if (url === CAREERS_URL) need(!/<title\b[^>]*>\s*(?:Access Denied|Forbidden|Just a moment|Attention Required)|<Code>\s*AccessDenied/i.test(body), 'native access denial or challenge')
    return { url, finalUrl: response.url, status: response.status, contentType, redirectLocation, startedAt, capturedAt: iso(captureClock('capturedAt', url)), bytes, sha256: createHash('sha256').update(raw).digest('hex'), body, captureClockInjected: captureClock !== clock }
  } catch (error) {
    cancel(signal?.aborted || own.signal.aborted ? reason() : error)
    checkAbort()
    if (error?.abortRetries === true) throw error
    throw failure(error?.message || 'native transport unavailable', { cause: error, code: 'native_transport_unavailable' })
  } finally {
    clearTimeout(timer)
    try { reader?.releaseLock() } catch {}
  }
}
