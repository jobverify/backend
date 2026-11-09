import {createHash} from 'node:crypto'

const JOBS_URL = 'https://jadeglobal.wd5.myworkdayjobs.com/wday/cxs/jadeglobal/Jade_Careers/jobs'
const MAINTENANCE_URL = 'https://static.community.workday.com/maintenance-page.html'
const MAINTENANCE_SHA256 = 'de90a2f5dc54e2af0d1739a62cf078645173b5e9b047c9dbd4ce8bbbdde82bee'
const FIRST_QUERY = JSON.stringify({appliedFacets: {}, limit: 20, offset: 0, searchText: ''})
const BODY_LIMIT = 3 * 1024 * 1024
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const cancel = body => { try { Promise.resolve(body?.cancel?.()).catch(() => {}) } catch {} }
const wait = (operation, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) { reject(signal.reason); return }
  const onAbort = () => reject(signal.reason)
  signal?.addEventListener('abort', onAbort, {once: true})
  Promise.resolve().then(() => { signal?.throwIfAborted(); return operation() })
    .then(resolve, reject).finally(() => signal?.removeEventListener('abort', onAbort))
})
const readClone = async (response, signal) => {
  const clone = response.clone(), reader = clone.body?.getReader()
  if (!reader) return Buffer.alloc(0)
  let bytes = 0
  const chunks = []
  try {
    while (true) {
      const part = await wait(() => reader.read(), signal)
      if (part.done) return Buffer.concat(chunks)
      bytes += part.value.byteLength
      if (bytes > BODY_LIMIT) throw Object.assign(new Error('Jade maintenance response exceeds admitted body size'), {failureKind: 'parser_or_contract_error', abortRetries: true})
      chunks.push(Buffer.from(part.value))
    }
  } catch (error) {
    try { Promise.resolve(reader.cancel()).catch(() => {}) } catch {}
    cancel(response.body)
    throw error
  } finally { try { reader.releaseLock() } catch {} }
}
const isOriginalHtmlParserError = (error, url) => {
  const expected = `Expected JSON from ${url} but received HTML (Workday is currently unavailable.)`
  const seen = new Set()
  for (let current = error; current && typeof current === 'object' && !seen.has(current); current = current.cause) {
    seen.add(current)
    if (current.failureKind === 'parser_or_contract_error' && current.abortRetries === true && current.message === expected) return true
  }
  return false
}

// The caller supplies the unchanged shared reader; fetch observation is local
// to each request and never changes process-global fetch state.
// Only this source's observed default first query + exact published maintenance
// response is admitted. This creates no native vacancy or inventory authority.
export const createJadeJsonAvailabilityReader = ({fetchJsonWithRetry, fetchImpl = (...args) => fetch(...args)}) => async (url, options = {}) => {
  const eligible = url === JOBS_URL && options.method === 'POST' && options.body === FIRST_QUERY
  let evidence = null
  const observeFetch = async (requestURL, init = {}) => {
    const pending = Promise.resolve().then(() => { init.signal?.throwIfAborted(); return fetchImpl(requestURL, init) })
    pending.then(response => { if (init.signal?.aborted) cancel(response.body) }, () => {})
    const response = await wait(() => pending, init.signal)
    if (!eligible || String(requestURL) !== JOBS_URL || init.method !== 'POST' || init.body !== FIRST_QUERY
      || response.status !== 200 || response.url !== MAINTENANCE_URL || response.headers.get('content-type') !== 'text/html') return response
    const body = await readClone(response, init.signal)
    if (hash(body) === MAINTENANCE_SHA256) evidence = Object.freeze({
      requestedURL: JOBS_URL, requestMethod: 'POST', requestBodySHA256: hash(FIRST_QUERY),
      finalURL: MAINTENANCE_URL, status: response.status, mime: response.headers.get('content-type'),
      bodyBytes: body.length, bodySHA256: MAINTENANCE_SHA256, completeBody: true,
      source: 'jadeglobal', authority: 'exact-published-workday-maintenance-response',
      redirectQualification: 'Source intent and final response observed; intermediate redirect hops/methods not retained',
    })
    return response
  }
  try { return await fetchJsonWithRetry(url, {...options, fetchImpl: observeFetch}) }
  catch (error) {
    if (options.signal?.aborted) throw options.signal.reason
    if (!evidence || !isOriginalHtmlParserError(error, url)) throw error
    const failure = new Error('[jadeglobal] Published Workday service interruption prevents reading the configured native inventory', {cause: error})
    Object.assign(failure, {name: 'JadeGlobalMaintenanceUnavailableError', softFailure: true, upstreamOutage: true,
      failureType: 'upstream_unavailable', failureKind: 'upstream_unavailable', abortRetries: true,
      status: evidence.status, requestURL: evidence.requestedURL, finalURL: evidence.finalURL,
      nativeResponseEvidence: evidence})
    throw failure
  }
}
