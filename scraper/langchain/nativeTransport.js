import { types } from 'node:util'

const typedArray = Object.getPrototypeOf(Uint8Array.prototype)
const intrinsic = name => Object.getOwnPropertyDescriptor(typedArray, name).get
const byteLength = intrinsic('byteLength'), byteOffset = intrinsic('byteOffset'), arrayBuffer = intrinsic('buffer')
const ignoreCleanupFailure = operation => {
  try { Promise.resolve(operation()).catch(() => {}) } catch {}
}
const requireValue = (value, message) => {
  if (!value) throw Object.assign(Error('[langchain] ' + message), {
    failureKind: 'coverage_gap', softFailure: true, upstreamOutage: false, abortRetries: true,
  })
}

// Check monotonic deadlines on both sides of synchronous operations too. A
// timer alone cannot fire while a supplied transport or native parse is busy.
export function withNativeAbort(operation, signal, check, disposeLate) {
  return new Promise((resolve, reject) => {
    let settled = false, failure
    const detach = () => signal.removeEventListener('abort', aborted)
    const fail = reason => {
      if (settled) return
      settled = true; failure = reason; detach(); reject(reason)
    }
    const aborted = () => fail(signal.reason)
    signal.addEventListener('abort', aborted, { once: true })
    try { check() } catch (error) { fail(error); return }
    Promise.resolve().then(() => { check(); return operation() }).then(value => {
      if (settled) { if (disposeLate) ignoreCleanupFailure(() => disposeLate(value, failure)); return }
      try { check() } catch (error) {
        fail(error); if (disposeLate) ignoreCleanupFailure(() => disposeLate(value, error)); return
      }
      settled = true; detach(); resolve(value)
    }, error => {
      if (settled) return
      try { check() } catch (expired) { error = expired }
      fail(error)
    })
  })
}

// Source-local 8 MB reader. It owns late fetch/getReader/read promises and
// initiates cleanup without awaiting an uncooperative cancel implementation.
export async function readNativePublicDocument(url, { signal, callerSignal = signal, check, byteLimit }) {
  const cancelled = new WeakSet(), released = new WeakSet()
  let response, reader
  const release = value => {
    if (!value || released.has(value)) return
    released.add(value); ignoreCleanupFailure(() => value.releaseLock())
  }
  const cancelReader = (value, reason) => {
    if (!value || cancelled.has(value)) return
    cancelled.add(value); ignoreCleanupFailure(() => value.cancel(reason)); release(value)
  }
  const cancelResponse = (value, reason) => ignoreCleanupFailure(() => {
    const body = value?.body
    if (!body || cancelled.has(body)) return
    cancelled.add(body); return body.cancel(reason)
  })
  const wait = (operation, disposeLate) => withNativeAbort(operation, signal, check, disposeLate)
  try {
    response = await wait(() => fetch(url, { method: 'GET', redirect: 'manual', credentials: 'omit',
      referrerPolicy: 'no-referrer', signal, headers: { Accept: 'application/json, text/html;q=0.9',
        'User-Agent': 'Mozilla/5.0 (compatible; Jobverify LangChain public inventory)' } }), cancelResponse)
    check()
    const headers = Object.fromEntries([...response.headers].filter(([name]) => name.toLowerCase() !== 'set-cookie'))
    const declared = response.headers.get('content-length')
    requireValue(declared == null || /^\d+$/.test(declared) && Number(declared) <= byteLimit, 'Declared response byte limit exceeded')
    check()
    if (response.status >= 300 && response.status < 400) {
      cancelResponse(response)
      return { status: response.status, url: response.url, headers, bodyUnavailable: true,
        bodyUnavailableReason: 'Redirect metadata retained; redirect body was not read or invented.' }
    }
    requireValue(response.body && typeof response.body.getReader === 'function', 'Public response body unavailable')
    reader = await wait(() => response.body.getReader(), cancelReader)
    const chunks = []
    let size = 0
    for (;;) {
      const part = await wait(() => reader.read())
      check()
      if (part.done) break
      requireValue(types.isUint8Array(part.value), 'Public response chunk must be a Uint8Array')
      const length = byteLength.call(part.value)
      requireValue(length <= byteLimit - size, 'Streamed response byte limit exceeded')
      check()
      chunks.push(Buffer.from(new Uint8Array(arrayBuffer.call(part.value), byteOffset.call(part.value), length)))
      size += length; check()
    }
    const bytes = Buffer.concat(chunks, size)
    check()
    const body = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    check()
    return { status: response.status, url: response.url, headers, body }
  } catch (error) {
    if (reader) cancelReader(reader, error); else cancelResponse(response, error)
    // Caller reasons are opaque values and must never be decorated or replaced.
    if (callerSignal?.aborted) throw callerSignal.reason
    // A failed/expired body cannot erase the already observed denied headers.
    // No unavailable bytes, body hash or response text are manufactured.
    if ([401, 403, 406, 429, 451].includes(response?.status)) {
      throw Object.assign(Error('[langchain] Public source HTTP ' + response.status + '; original body unavailable', { cause: error }), {
        status: response.status, statusCode: response.status, requestUrl: url,
        failureKind: 'blocked_or_access_denied', softFailure: true, upstreamOutage: true, abortRetries: true,
        nativeHttpReceipt: { requestedUrl: url, url: response.url, method: 'GET', status: response.status,
          contentType: response.headers?.get('content-type') ?? null, bodyUnavailable: true,
          bodyBytes: null, bodySHA256: null, bodyUnavailableReason: 'Original response body failed or exceeded its existing deadline.' },
      })
    }
    throw error
  } finally { release(reader) }
}

// Caller-parsed JSON is a different provenance from HTTP response bytes. Bound
// its rows and exact JSON UTF-8 size before allocating a serialized body. Plain
// data only: getters, toJSON hooks, cycles and deep trees cannot evade preflight.
export function serializeNativePayload(payload, { check, byteLimit, nativeRows }) {
  check()
  requireValue(payload && typeof payload === 'object' && !types.isProxy(payload), 'Invalid caller-parsed native inventory schema or opaque Proxy')
  const payloadFields = Object.getOwnPropertyDescriptors(payload)
  requireValue(Object.hasOwn(payloadFields.apiVersion || {}, 'value') && Object.hasOwn(payloadFields.jobs || {}, 'value')
    && payloadFields.apiVersion.value === '1' && !types.isProxy(payloadFields.jobs.value) && Array.isArray(payloadFields.jobs.value)
    && payloadFields.jobs.value.length <= nativeRows, 'Invalid caller-parsed native inventory schema or row limit')
  let size = 0, nodes = 0
  const ancestors = new Set()
  const add = length => { requireValue(length <= byteLimit - size, 'Response or aggregate byte limit exceeded before JSON serialization'); size += length }
  const quoted = value => {
    requireValue(value.length <= byteLimit - size, 'Response or aggregate byte limit exceeded before JSON serialization')
    add(2)
    for (let at = 0; at < value.length; at++) {
      if ((at & 1023) === 0) check()
      const code = value.charCodeAt(at)
      if (code === 34 || code === 92 || [8, 9, 10, 12, 13].includes(code)) add(2)
      else if (code < 32) add(6)
      else if (code < 128) add(1)
      else if (code < 2048) add(2)
      else if (code >= 0xD800 && code <= 0xDBFF && value.charCodeAt(at + 1) >= 0xDC00 && value.charCodeAt(at + 1) <= 0xDFFF) { add(4); at++ }
      else if (code >= 0xD800 && code <= 0xDFFF) add(6)
      else add(3)
    }
  }
  const visit = (value, depth = 0) => {
    check()
    requireValue(++nodes <= nativeRows * 100 && depth <= 16, 'Caller-parsed native inventory structure limit exceeded')
    if (value === null) { add(4); return }
    if (typeof value === 'string') { quoted(value); return }
    if (typeof value === 'boolean') { add(value ? 4 : 5); return }
    if (typeof value === 'number' && Number.isFinite(value)) { add(String(value).length); return }
    requireValue(typeof value === 'object' && !types.isProxy(value) && !ancestors.has(value)
      && [Object.prototype, Array.prototype, null].includes(Object.getPrototypeOf(value)), 'Caller-parsed native inventory must contain only JSON data')
    ancestors.add(value)
    const descriptors = Object.getOwnPropertyDescriptors(value)
    requireValue(!('toJSON' in value) && Object.values(descriptors).every(descriptor => Object.hasOwn(descriptor, 'value')),
      'Caller-parsed native inventory must not contain toJSON hooks or accessors')
    const entries = Object.entries(descriptors).filter(([, descriptor]) => descriptor.enumerable)
    if (Array.isArray(value)) {
      requireValue(value.length <= nativeRows && entries.length === value.length, 'Caller-parsed native array or row limit exceeded')
      add(2)
      for (let index = 0; index < value.length; index++) {
        if (index) add(1)
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
        requireValue(descriptor && Object.hasOwn(descriptor, 'value'), 'Caller-parsed native array must contain only JSON data')
        visit(descriptor.value, depth + 1)
      }
    } else {
      add(2)
      for (const [index, [key, descriptor]] of entries.entries()) {
        if (index) add(1)
        quoted(key); add(1); visit(descriptor.value, depth + 1)
      }
    }
    ancestors.delete(value)
  }
  visit(payload); check()
  const body = JSON.stringify(payload)
  check()
  requireValue(Buffer.byteLength(body) <= byteLimit, 'Response or aggregate byte limit exceeded')
  return body
}
