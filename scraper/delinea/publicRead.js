import crypto from 'node:crypto'
import { createHTMLTransport, MAX_HTML_BYTES } from '../../scraper-support/shared/firstPartyHtmlJobs.js'

export const DELINEA_READ_LIMITS = Object.freeze({ requests: 96, decodedBytes: 48 * 1024 * 1024, cohortMs: 180000 })
const challenge = body => /just a moment|verify you are human|access denied|cf-chl-|captcha challenge/i.test(body)
const error = (message, fields = {}) => Object.assign(new Error('Delinea public read: ' + message), { abortRetries: true, ...fields })
const validateURL = value => {
  const url = new URL(value)
  const known = url.hostname === 'delinea.com' && /^\/(?:de\/|es\/|fr\/|pt\/)?careers\/?$/.test(url.pathname)
    || url.hostname === 'jobs.ashbyhq.com' && /^\/delinea(?:\/[a-z\d._-]+)?$/.test(url.pathname)
    || url.hostname === 'api.ashbyhq.com' && url.pathname === '/posting-api/job-board/delinea'
    || url.hostname === 'centrify.wd1.myworkdayjobs.com' && url.pathname === '/en-US/External/'
  if (!known || url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) {
    throw error('URL is outside the reviewed employer/account/read identity')
  }
}

// Keep the existing collector and its legacy test injection surface. The live
// default reads have manual HTTP identity, bounded streams and a cohort budget.
export function createDelineaPublicReader({ signal, fetchImpl = globalThis.fetch, transport, fetchText, fetchJson, onNativeResponse } = {}) {
  const deadline = new AbortController()
  const timer = setTimeout(() => deadline.abort(error('180-second cohort limit', { code: 'DELINEA_COHORT_LIMIT' })), DELINEA_READ_LIMITS.cohortMs)
  timer.unref?.()
  const requestSignal = signal ? AbortSignal.any([signal, deadline.signal]) : deadline.signal
  const deniedHosts = new Map(), responses = []
  const deny = (host, status, message) => {
    if (!deniedHosts.has(host)) deniedHosts.set(host, error(message, { status }))
  }
  const nativeRead = transport || createHTMLTransport({ validateURL,
    expectedContentType: url => new URL(url).hostname === 'api.ashbyhq.com' ? 'application/json' : 'text/html',
  }, { signal: requestSignal, fetchImpl: async (url, options) => {
    const response = await fetchImpl(url, options)
    signal?.throwIfAborted()
    // Headers are available before the shared reader checks body bounds or
    // acquires the stream. A failed body must not erase a known HTTP denial.
    if ([401, 403, 429].includes(response?.status)) deny(new URL(url).hostname, response.status, 'denied host HTTP ' + response.status)
    return response
  } })
  let requests = 0, decodedBytes = 0, limitExceeded = false
  const limit = message => { limitExceeded = true; throw error(message, { code: 'DELINEA_COHORT_LIMIT' }) }
  const check = () => {
    signal?.throwIfAborted()
    if (deadline.signal.aborted) { limitExceeded = true; throw deadline.signal.reason }
    if (limitExceeded) limit('cohort limit already reached')
  }
  async function read(url, json = false) {
    check(); validateURL(url)
    const host = new URL(url).hostname
    if (deniedHosts.has(host)) throw deniedHosts.get(host)
    if (requests >= DELINEA_READ_LIMITS.requests) limit('96-GET cohort budget exhausted')
    // Reserve the maximum permitted response before starting another GET.
    if (decodedBytes + MAX_HTML_BYTES > DELINEA_READ_LIMITS.decodedBytes) limit('48MiB decoded cohort budget exhausted')
    requests++
    const injected = json ? fetchJson : fetchText
    let body, value
    try {
      if (injected) {
        value = await injected(url, { signal: requestSignal })
        check()
        body = json ? JSON.stringify(value) : value
        if (typeof body === 'string' && challenge(body.slice(0, MAX_HTML_BYTES))) deny(host, 403, 'challenge/denial on public host')
        if (typeof body !== 'string' || Buffer.byteLength(body) > MAX_HTML_BYTES) throw error('2MiB body bound')
        decodedBytes += Buffer.byteLength(body)
      } else {
        const packet = await nativeRead(url, { signal: requestSignal })
        if ([401, 403, 429].includes(packet?.status)) deny(host, packet.status, 'denied host HTTP ' + packet.status)
        // Inspect only a bounded prefix before body validation or telemetry can
        // throw. Complete-packet injection has the same terminal authority as HTTP.
        if (packet?.body instanceof Uint8Array && challenge(new TextDecoder().decode(packet.body.subarray(0, MAX_HTML_BYTES)))) {
          deny(host, 403, 'challenge/denial on public host')
        }
        check()
        if (packet?.url !== url || packet.bodyComplete !== true || !(packet.body instanceof Uint8Array)
          || !Number.isInteger(packet.status) || !packet.headers) throw error('incomplete or changed response identity')
        const bytes = Buffer.from(packet.body)
        if (bytes.length > MAX_HTML_BYTES) throw error('2MiB body bound')
        decodedBytes += bytes.length
        responses.push({ url, status: packet.status, bodyBytes: bytes.length,
          bodySHA256: crypto.createHash('sha256').update(bytes).digest('hex'),
          requestedAt: packet.requestedAt || null, completedAt: packet.completedAt || null,
          contentType: packet.headers['content-type'] || null, redirectLocation: packet.headers.location || null })
        await onNativeResponse?.({ ...packet, body: bytes })
        check()
        if (deniedHosts.has(host)) throw deniedHosts.get(host)
        if (packet.status >= 300 && packet.status < 400) throw error('redirect changes response identity: HTTP ' + packet.status
          + ' ' + String(packet.headers.location || ''), { status: packet.status })
        if (packet.status !== 200) throw error('HTTP ' + packet.status, { status: packet.status })
        const contentType = packet.headers['content-type']?.split(';')[0].trim().toLowerCase()
        const allowed = host === 'api.ashbyhq.com' ? ['application/json']
          : host === 'centrify.wd1.myworkdayjobs.com' ? ['text/html', 'application/json'] : ['text/html']
        if (!allowed.includes(contentType)) throw error('unexpected response content type')
        body = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      }
      if (decodedBytes > DELINEA_READ_LIMITS.decodedBytes) limit('48MiB decoded cohort budget exhausted')
      if (deniedHosts.has(host)) throw deniedHosts.get(host)
      return json ? injected ? value : JSON.parse(body) : body
    } catch (failure) {
      // Caller cancellation keeps its exact reason, including non-Error values.
      signal?.throwIfAborted()
      const terminal = deniedHosts.get(host)
      if (terminal) {
        if (failure !== terminal) terminal.cause = failure
        throw terminal
      }
      throw failure
    }
  }
  return { readText: url => read(url), readJson: url => read(url, true),
    get limitExceeded() { return limitExceeded || deadline.signal.aborted },
    get audit() { return { requests, decodedBytes, responses, deniedHosts: [...deniedHosts.keys()], limits: DELINEA_READ_LIMITS } },
    get observedAt() {
      const values = responses.map(response => response.completedAt)
      return values.length && values.every(value => typeof value === 'string' && Number.isFinite(Date.parse(value)))
        ? values.sort((a, b) => Date.parse(a) - Date.parse(b))[0] : null
    },
    dispose() { clearTimeout(timer) },
  }
}
