import {createHash} from 'node:crypto'
import {types} from 'node:util'

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
const MAX_SOURCE_BYTES = 8 * 1024 * 1024
const typedArray = Object.getPrototypeOf(Uint8Array.prototype)
const intrinsic = name => Object.getOwnPropertyDescriptor(typedArray, name).get
const byteLength = intrinsic('byteLength'), byteOffset = intrinsic('byteOffset'), arrayBuffer = intrinsic('buffer')
const header = (headers, name) => typeof headers?.get === 'function' ? headers.get(name)
  : Object.entries(headers || {}).find(([key]) => key.toLowerCase() === name)?.[1] ?? null
const ignore = operation => { try { Promise.resolve(operation()).catch(() => {}) } catch {} }
const race = (operation, signal, check = () => signal.throwIfAborted(), disposeLate) => new Promise((resolve, reject) => {
  let settled = false, failure
  const detach = () => signal.removeEventListener('abort', abort)
  const fail = reason => { if (!settled) { settled = true; failure = reason; detach(); reject(reason) } }
  const abort = () => fail(signal.reason)
  signal.addEventListener('abort', abort, {once:true})
  try { check() } catch (error) { fail(error); return }
  Promise.resolve().then(() => { check(); return operation() }).then(value => {
    if (settled) { if (disposeLate) ignore(() => disposeLate(value, failure)); return }
    try { check() } catch (error) { fail(error); if (disposeLate) ignore(() => disposeLate(value, error)); return }
    settled = true; detach(); resolve(value)
  }, error => {
    if (settled) return
    try { check() } catch (expired) { error = expired }
    fail(error)
  })
})
const cancel = body => { try { Promise.resolve(body?.cancel()).catch(() => {}) } catch {} }

// A corporate crawl is discovery evidence. It cannot establish an empty vacancy
// inventory, even when every checked careers route is missing or unavailable.
export const withUnverifiedPublicSurface = async ({source, urls, options = {}, injected}, operation) => {
  const caller = options.signal
  caller?.throwIfAborted()
  const requestTimeoutMs = options.requestTimeoutMs ?? 15000
  const collectionTimeoutMs = options.collectionTimeoutMs ?? 90000
  if (!Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs < 1 || requestTimeoutMs > 30000
    || !Number.isSafeInteger(collectionTimeoutMs) || collectionTimeoutMs < 1 || collectionTimeoutMs > 180000)
    throw RangeError('Invalid public source deadline')
  const allowed = new Set(urls)
  for (const url of allowed) {
    const target = new URL(url)
    if (target.protocol !== 'https:' || target.username || target.password || target.port || target.hash || target.href !== url)
      throw Error('Invalid configured public source URL')
  }
  const startedAt = new Date().toISOString(), started = performance.now(), responses = []
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new DOMException('Public source collection deadline exceeded', 'TimeoutError')), collectionTimeoutMs)
  const signal = caller ? AbortSignal.any([caller, controller.signal]) : controller.signal
  const checkSource = () => {
    caller?.throwIfAborted()
    if (!controller.signal.aborted && performance.now() - started >= collectionTimeoutMs)
      controller.abort(new DOMException('Public source collection deadline exceeded', 'TimeoutError'))
    signal.throwIfAborted()
  }
  let bytesRead = 0
  const gap = (reason, firstParty = false) => ({status:'coverage-gap', surface:urls[0], firstParty,
    listingComplete:false, pagesFetched:responses.filter(row => row.status === 200 && row.bodyComplete).length,
    reportedTotal:null, indiaFacetCount:null, verifiedAt:null, reason})
  const fail = (message, details = {}) => {
    const status = Number.isInteger(details.status) ? details.status : null
    const blocked = [401, 403, 429, 451].includes(status)
    const error = Object.assign(Error(source + ': ' + message, details.cause ? {cause:details.cause} : undefined), {
      source, softFailure:true, abortRetries:true, lifecycleCleanupAllowed:false,
      upstreamOutage:blocked || status >= 500,
      failureKind:details.failureKind ?? (blocked ? 'blocked_or_access_denied' : status >= 500 ? 'network_or_timeout' : 'source_inventory_unavailable'),
      status, requestUrl:details.requestUrl ?? responses.at(-1)?.requestUrl ?? urls[0],
      finalUrl:details.finalUrl ?? responses.at(-1)?.finalUrl ?? null,
      inventoryEvidence:gap(message), unverifiedPublicSurfaceFailure:true,
      nativeEvidence:{source, startedAt, completedAt:new Date().toISOString(), responses:structuredClone(responses),
        companyGlobalTotal:null, companyIndiaTotal:null, lifecycleCleanupAllowed:false},
    })
    if (status === 429) {
      const value = String(details.retryAfter ?? '').trim(), seconds = Number(value)
      const date = Date.parse(value)
      if (value && Number.isFinite(seconds) && seconds >= 0) error.retryDelayMs = Math.ceil(seconds * 1000)
      else if (value && Number.isFinite(date)) error.retryDelayMs = Math.max(0, date - Date.now())
    }
    return error
  }
  const read = async url => {
    checkSource()
    if (!allowed.has(url) || responses.length >= allowed.size) throw fail('Public read is outside the configured source contract')
    const receipt = {requestUrl:url, requestedAt:new Date().toISOString(), status:null, finalUrl:null, bodyComplete:false}
    responses.push(receipt)
    const deadline = new AbortController()
    const requestStarted = performance.now()
    const requestTimer = setTimeout(() => deadline.abort(new DOMException('Public document request/body deadline exceeded', 'TimeoutError')), requestTimeoutMs)
    const requestSignal = AbortSignal.any([signal, deadline.signal])
    const checkRequest = () => {
      checkSource()
      if (!deadline.signal.aborted && performance.now() - requestStarted >= requestTimeoutMs)
        deadline.abort(new DOMException('Public document request/body deadline exceeded', 'TimeoutError'))
      requestSignal.throwIfAborted()
    }
    let response, reader
    try {
      let page
      if (injected) page = await race(() => injected(url, {method:'GET', redirect:'manual', credentials:'omit', signal:requestSignal}), requestSignal, checkRequest, value => cancel(value?.body))
      else {
        response = await race(() => (options.fetchImpl ?? globalThis.fetch)(url, {
          method:'GET', redirect:'manual', credentials:'omit', signal:requestSignal,
          headers:{Accept:'text/html,application/xhtml+xml,application/xml,text/xml,text/plain;q=0.9',
            'User-Agent':'Mozilla/5.0 (compatible; Jobverify scraper)'},
        }), requestSignal, checkRequest, value => cancel(value?.body))
        page = {status:response.status, url:response.url || url, headers:response.headers}
      }
      checkRequest()
      const finalUrl = page?.finalUrl ?? page?.url ?? url
      Object.assign(receipt, {status:page?.status ?? null, finalUrl, location:header(page?.headers, 'location')})
      checkRequest()
      const status = receipt.status
      if (Number.isInteger(status) && status !== 200) {
        throw fail('Original public document returned HTTP ' + status, {status, requestUrl:url, finalUrl,
          retryAfter:header(page.headers, 'retry-after'),
          ...(![401,403,429,451].includes(status) && status < 500 ? {failureKind:'surface_drift_or_fail_closed'} : {})})
      }
      if (!Number.isInteger(status) || page?.errorKind) throw fail('Public document network/timeout response unavailable', {
        requestUrl:url, finalUrl, failureKind:'network_or_timeout'})
      if (finalUrl !== url || page.url && page.url !== url) throw fail('Original public response URL identity changed', {
        status, requestUrl:url, finalUrl, failureKind:'surface_drift_or_fail_closed'})
      let html
      if (response) {
        const type = header(response.headers, 'content-type') || ''
        checkRequest()
        if (!/^(?:text\/(?:html|xml|plain)|application\/(?:xhtml\+xml|xml))(?:\s*;|$)/i.test(type))
          throw fail('Public document response MIME is unqualified', {status})
        const length = header(response.headers, 'content-length')
        checkRequest()
        if (length && (!/^\d+$/.test(length) || Number(length) > MAX_RESPONSE_BYTES))
          throw fail('Public document declared byte limit exceeded', {status})
        if (!response.body?.getReader) throw fail('Public document readable body unavailable', {status})
        reader = await race(() => response.body.getReader(), requestSignal, checkRequest, value => { cancel(value); ignore(() => value.releaseLock()) })
        const chunks = []
        let size = 0
        while (true) {
          const {done, value} = await race(() => reader.read(), requestSignal, checkRequest)
          checkRequest()
          if (done) break
          if (!types.isUint8Array(value)) throw fail('Public document native body chunk is not a Uint8Array', {status})
          const length = byteLength.call(value)
          if (length > MAX_RESPONSE_BYTES - size || length > MAX_SOURCE_BYTES - bytesRead - size)
            throw fail('Public document decoded byte limit exceeded', {status})
          checkRequest()
          chunks.push(Buffer.from(new Uint8Array(arrayBuffer.call(value), byteOffset.call(value), length)))
          size += length
          checkRequest()
        }
        checkRequest()
        html = new TextDecoder('utf-8', {fatal:true}).decode(Buffer.concat(chunks, size))
      } else html = page?.html ?? page?.body
      checkRequest()
      if (typeof html !== 'string') throw fail('Public document text body unavailable', {status})
      const size = Buffer.byteLength(html)
      if (size > MAX_RESPONSE_BYTES || bytesRead + size > MAX_SOURCE_BYTES)
        throw fail('Public document decoded byte limit exceeded', {status})
      bytesRead += size
      Object.assign(receipt, {bodyComplete:true, bytes:size, sha256:createHash('sha256').update(html).digest('hex')})
      checkRequest()
      return {...page, url, finalUrl, html}
    } catch (error) {
      if (caller?.aborted) throw caller.reason
      if (error?.unverifiedPublicSurfaceFailure) throw error
      throw fail(requestSignal.aborted ? 'Public document request/body deadline exceeded' : 'Public document network/response read failed', {
        cause:error, status:receipt.status, requestUrl:url, finalUrl:receipt.finalUrl, failureKind:'network_or_timeout'})
    } finally {
      clearTimeout(requestTimer)
      if (reader) { cancel(reader); try { reader.releaseLock() } catch {} }
      else cancel(response?.body)
      receipt.completedAt = new Date().toISOString()
    }
  }
  try { return await race(() => operation({read, fail, gap, responses}), signal, checkSource) }
  catch (error) {
    if (caller?.aborted) throw caller.reason
    if (error?.unverifiedPublicSurfaceFailure) {
      error.nativeEvidence.responses = structuredClone(responses)
      error.nativeEvidence.completedAt = new Date().toISOString()
      throw error
    }
    if (signal.aborted) throw fail('Public source collection deadline exceeded', {cause:error, failureKind:'network_or_timeout'})
    throw error
  } finally { clearTimeout(timer); controller.abort() }
}
