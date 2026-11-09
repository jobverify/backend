// Aadyah-only bounded original-response transport. No shared reader is changed.
import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

export const sha = value => createHash('sha256').update(value).digest('hex')
const ignore = operation => {try {Promise.resolve(operation()).catch(() => {})} catch {}}
const object = value => value !== null && (typeof value === 'object' || typeof value === 'function')
const header = (headers, name) => Object.entries(headers).find(([key]) => key.toLowerCase() === name)?.[1] ?? null
const headersOf = headers => Object.fromEntries(new Headers(headers ?? {}))
const arrayPrototype = Object.getPrototypeOf(Uint8Array.prototype)
const intrinsic = name => Object.getOwnPropertyDescriptor(arrayPrototype, name).get
const byteLength = intrinsic('byteLength'), byteOffset = intrinsic('byteOffset'), arrayBuffer = intrinsic('buffer')

// Subscribe before calling any supplied work, including synchronous abort/throw.
const race = (operation, signal, check, disposeLate) => new Promise((resolve, reject) => {
  let settled = false, failure
  const detach = () => signal.removeEventListener('abort', aborted)
  const fail = reason => {if (!settled) {settled = true; failure = reason; detach(); reject(reason)}}
  const aborted = () => fail(signal.reason)
  signal.addEventListener('abort', aborted, {once: true})
  try {check()} catch (error) {fail(error); return}
  Promise.resolve().then(() => {check(); return operation()}).then(value => {
    if (settled) {if (disposeLate) ignore(() => disposeLate(value, failure)); return}
    try {check()} catch (error) {fail(error); if (disposeLate) ignore(() => disposeLate(value, error)); return}
    settled = true; detach(); resolve(value)
  }, error => {
    if (settled) return
    try {check()} catch (expired) {error = expired}
    fail(error)
  })
})

function controls(options) {
  const limit = (name, fallback, maximum, minimum = 1) => {
    const value = options[name] ?? fallback
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw RangeError('Aadyah invalid ' + name + ' limit')
    return value
  }
  for (const name of ['timeoutMs', 'collectionTimeoutMs', 'collectionBudgetMs']) if (options[name] != null) limit(name, 1, name === 'timeoutMs' ? 60000 : 600000)
  const requestTimeoutMs = limit('requestTimeoutMs', options.timeoutMs ?? 20000, 60000)
  const bounds = {requestTimeoutMs, entityTimeoutMs: limit('entityTimeoutMs', requestTimeoutMs, 60000),
    sourceTimeoutMs: limit('sourceTimeoutMs', options.collectionTimeoutMs ?? options.collectionBudgetMs ?? 180000, 600000),
    callbackTimeoutMs: limit('callbackTimeoutMs', 10000, 30000),
    maxResponseBytes: limit('maxResponseBytes', 2 * 1024 * 1024, 16 * 1024 * 1024),
    maxSourceBytes: limit('maxSourceBytes', 8 * 1024 * 1024, 32 * 1024 * 1024),
    maxTotalBytes: limit('maxTotalBytes', 8 * 1024 * 1024, 32 * 1024 * 1024),
    maxRequests: limit('maxRequests', 8, 64), maxPages: limit('maxPages', 8, 64)}
  if (options.maxJobs != null) limit('maxJobs', 0, 1000000, 0)
  for (const name of ['fetchPage', 'fetchImpl', 'fetchText', 'onAudit', 'onMetadata', 'onRecords', 'now', 'monotonicNow']) {
    if (options[name] !== undefined && typeof options[name] !== 'function') throw TypeError('Aadyah invalid ' + name + ' callback or clock')
  }
  if (options.heldHosts !== undefined && !(options.heldHosts instanceof Set)) throw TypeError('Aadyah invalid heldHosts control')
  if (options.signal !== undefined && !(options.signal instanceof AbortSignal)) throw TypeError('Aadyah invalid caller signal')
  return bounds
}

function clocks(options) {
  const wall = () => {
    const value = options.now ? options.now() : new Date()
    if (!(value instanceof Date) && typeof value !== 'string' && typeof value !== 'number') throw RangeError('Aadyah invalid source clock')
    const date = new Date(value)
    if (value === '' || !Number.isFinite(date.getTime())) throw RangeError('Aadyah invalid source clock')
    return date.toISOString()
  }
  let last = -1
  const monotonic = () => {
    const value = options.monotonicNow ? options.monotonicNow() : performance.now()
    if (!Number.isFinite(value) || value < 0 || value < last) throw RangeError('Aadyah invalid monotonic clock')
    last = value
    return value
  }
  const startedAt = wall()
  monotonic()
  return {wall, monotonic, startedAt}
}

export async function collectAadyahContext(config, options, operation) {
  const sourceRealStart = performance.now()
  const caller = options.signal
  if (caller instanceof AbortSignal && caller.aborted) throw caller.reason
  const bounds = controls(options), clock = clocks(options), heldHosts = options.heldHosts ?? new Set(), ownedErrors = new WeakSet()
  const audit = {source: 'aadyahaerospace', startedAt: clock.startedAt, completedAt: null, outcome: 'coverage-gap', bounds,
    recordKind: 'hiring-signals', observedRecordCount: 0, observedVacancyCount: 0, observations: [], responses: [], rawPages: [], issues: [],
    sourceScopeComplete: false, listingComplete: false, nativeReportedTotal: null, nativeIndiaTotal: null,
    companyGlobalTotal: null, companyIndiaTotal: null, lifecycleCleanupAllowed: false, inventoryVerifiedAt: null,
    productionWrites: false, remoteProgramsExecuted: false, redirectsFollowed: false, subresourcesRequested: false, decodedBytes: 0}
  const gap = () => ({status: 'coverage-gap', surface: config.entry,
    firstParty: audit.responses.length === 8 && audit.responses.every(row => row.transportQualified),
    listingComplete: false, pagesFetched: audit.responses.filter(row => row.transportQualified && row.bodyComplete).length,
    reportedTotal: null, indiaFacetCount: null, verifiedAt: null,
    reason: 'Declared public header supplies a hiring anchor, not an enumerated vacancy inventory; native, company and India totals remain unknown.'})
  const fail = (message, details = {}) => {
    const error = Object.assign(Error('Aadyah ' + message), {source: 'aadyahaerospace', softFailure: true, abortRetries: true,
      lifecycleCleanupAllowed: false, code: 'AADYAH_PUBLIC_CONTEXT_CHANGED', failureKind: 'source_inventory_unavailable', ...details})
    ownedErrors.add(error)
    return error
  }
  const scope = (kind, milliseconds, parent) => {
    const controller = new AbortController(), realStart = parent ? performance.now() : sourceRealStart, logicalStart = clock.monotonic()
    const timeout = fail(kind + ' deadline exceeded', {code: 'AADYAH_PUBLIC_CONTEXT_TIMEOUT', failureKind: 'network_or_timeout'})
    timeout.name = 'TimeoutError'
    const signal = AbortSignal.any([controller.signal, ...(parent ? [parent.signal] : []), ...(caller ? [caller] : [])])
    const timer = setTimeout(() => controller.abort(timeout), Math.max(0, milliseconds - (performance.now() - realStart)))
    const check = () => {
      if (caller?.aborted) throw caller.reason
      parent?.check()
      const logicalElapsed = clock.monotonic() - logicalStart
      if (!controller.signal.aborted && Math.max(performance.now() - realStart, logicalElapsed) >= milliseconds) controller.abort(timeout)
      if (signal.aborted) throw signal.reason
    }
    return {signal, check, wait: (work, disposeLate) => race(work, signal, check, disposeLate), close: () => clearTimeout(timer)}
  }
  const source = scope('source', bounds.sourceTimeoutMs)
  const cancelled = new WeakSet(), released = new WeakSet()
  const release = reader => {if (object(reader) && !released.has(reader)) {released.add(reader); ignore(() => reader.releaseLock())}}
  const cancelReader = (reader, reason) => {
    if (object(reader) && !cancelled.has(reader)) {cancelled.add(reader); ignore(() => reader.cancel(reason))}
    release(reader)
  }
  const cancelBody = (response, reason) => ignore(() => {
    const body = response?.body
    if (object(body) && !cancelled.has(body)) {cancelled.add(body); return body.cancel(reason)}
  })
  const byteBudget = () => Math.min(bounds.maxResponseBytes, bounds.maxSourceBytes - audit.decodedBytes, bounds.maxTotalBytes - audit.decodedBytes)
  const assertBytes = size => {if (size > byteBudget()) throw fail('original entity byte budget exceeded')}
  const safeWall = () => {try {return clock.wall()} catch {return null}}
  const originalClocks = (page, receipt, row) => {
    for (const [target, alias] of [['sourceRequestedAt', 'requestedAt'], ['sourceCompletedAt', 'completedAt']]) {
      const pageAlias = page[alias], receiptAlias = receipt && Object.hasOwn(receipt, alias) ? receipt[alias] : undefined
      const values = [page[target], pageAlias, receipt?.[target], receiptAlias].filter(value => value != null)
      if (values.some(value => typeof value !== 'string' || !value || !Number.isFinite(Date.parse(value)))
        || values.some(value => value !== values[0])) throw fail('invalid or contradictory original acquisition clock')
      row[target] = values[0] ?? null
      row[alias] = pageAlias ?? receiptAlias ?? null
    }
    if (row.sourceRequestedAt && row.sourceCompletedAt && Date.parse(row.sourceCompletedAt) < Date.parse(row.sourceRequestedAt)) throw fail('original acquisition clock order changed')
    row.acquisitionClocksComplete = !!(row.sourceRequestedAt && row.sourceCompletedAt)
  }

  const read = async (url, kind, phase) => {
    source.check()
    if (!config.urls.includes(url)) throw fail('undeclared public entity refused locally')
    const host = new URL(url).hostname
    if (heldHosts.has(host)) throw fail('public host is held after denial; no retry or alias bypass', {failureKind: 'blocked_or_access_denied', heldHost: host})
    if (audit.responses.length >= bounds.maxRequests || audit.responses.length >= bounds.maxPages) throw fail('public request/page limit exceeded')
    const row = {requestUrl: url, requestedUrl: url, kind, phase, observedRequestedAt: clock.wall(), observedCompletedAt: null,
      status: null, finalUrl: null, headers: {}, bodyBase64: null, bytes: null, sha256: null, sourceRequestedAt: null,
      sourceCompletedAt: null, requestedAt: null, completedAt: null, sourceHttpDate: null, acquisitionClocksComplete: false,
      bodyComplete: false, transportQualified: false, denied: false}
    audit.responses.push(row)
    const request = scope('request', bounds.requestTimeoutMs, source)
    const init = {method: 'GET', redirect: 'manual', credentials: 'omit', signal: request.signal,
      headers: {Accept: 'text/html,application/javascript,application/json;q=0.9', 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)'},
      maxResponseBytes: bounds.maxResponseBytes, throwIfAborted: request.check}
    let response, reader, complete = false, readError
    try {
      let page, decodedOnly = false
      if (options.fetchPage) page = await request.wait(() => options.fetchPage(url, init), cancelBody)
      else if (options.fetchText && !options.fetchImpl) {
        page = await request.wait(() => options.fetchText(url, init), cancelBody)
        decodedOnly = typeof page === 'string' || typeof page?.bodyBase64 !== 'string'
      } else {
        const sourceRequestedAt = clock.wall()
        response = await request.wait(() => (options.fetchImpl ?? globalThis.fetch)(url, init), cancelBody)
        page = {url: response?.url, status: response?.status, headers: headersOf(response?.headers), sourceRequestedAt, sourceCompletedAt: null}
      }
      request.check()
      decodedOnly ||= typeof page === 'string'
      if (typeof page !== 'string') {
        row.status = page?.status ?? null; row.finalUrl = page?.finalUrl ?? page?.url ?? null
        row.headers = headersOf(page?.headers)
        row.location = header(row.headers, 'location')
        row.sourceHttpDate = page?.sourceHttpDate ?? header(row.headers, 'date')
        row.originalReceipt = page?.originalReceipt == null ? null : structuredClone(page.originalReceipt)
        row.provenance = page?.provenance == null ? null : structuredClone(page.provenance)
        row.denied = [401, 403, 429, 451].includes(row.status)
        if (row.denied) {heldHosts.add(host); row.heldHost = host; audit.heldHosts = [...heldHosts]}
        originalClocks(page, page.originalReceipt, row)
        if (row.status !== 200) throw fail('original public entity returned HTTP ' + row.status, {status: row.status,
          requestUrl: url, finalUrl: row.finalUrl, headers: structuredClone(row.headers), denied: row.denied, heldHost: row.denied ? host : null,
          failureKind: row.denied ? 'blocked_or_access_denied' : 'surface_drift_or_fail_closed'})
        if (page.url !== url || row.finalUrl !== url || page.requestedUrl !== undefined && page.requestedUrl !== url) throw fail('original response URL identity is missing or changed')
      }
      const mime = header(row.headers, 'content-type') || ''
      // This source uses HTML parsing rules. A declared XML MIME cannot use
      // decoded-only compatibility to acquire HTML declaration authority.
      if (kind === 'html' && mime && !/^text\/html(?:\s*;|$)/i.test(mime)) throw fail('original HTML MIME identity is unqualified')
      if (decodedOnly) {
        const body = typeof page === 'string' ? page : page?.html ?? page?.text
        if (typeof body !== 'string') throw fail('legacy decoded entity is unavailable')
        if (body.length > byteBudget()) throw fail('legacy decoded entity byte budget exceeded')
        const size = Buffer.byteLength(body)
        assertBytes(size); request.check()
        audit.decodedBytes += size
        row.decodedBytes = size; row.decodedSHA256 = sha(body)
        audit.issues.push({kind: 'unqualified-decoded-only-transport', url, phase})
        audit.rawPages.push({url, phase, originalText: body, transportQualified: false, bodyBase64: null})
        row.observedCompletedAt = clock.wall(); request.check()
        return {body, sha256: sha(body), qualified: false}
      }
      const allowed = kind === 'html' ? /^text\/html(?:\s*;|$)/i
        : kind === 'javascript' ? /^(?:text|application)\/(?:javascript|ecmascript|x-javascript)(?:\s*;|$)/i : /^application\/json(?:\s*;|$)/i
      if (!allowed.test(mime)) throw fail('original ' + kind + ' MIME identity is unqualified')
      const declaredLength = header(row.headers, 'content-length')
      if (declaredLength != null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > byteBudget())) throw fail('declared original entity byte limit exceeded')
      if (response) {
        if (!response.body?.getReader) throw fail('original readable entity body is unavailable')
        const entity = scope('entity', bounds.entityTimeoutMs, request)
        try {
          reader = await entity.wait(() => response.body.getReader(), cancelReader)
          const chunks = []; let size = 0
          for (;;) {
            const {done, value} = await entity.wait(() => reader.read())
            entity.check()
            if (done) break
            if (!types.isUint8Array(value)) throw fail('native entity chunk is not a Uint8Array')
            const length = byteLength.call(value)
            assertBytes(size + length)
            chunks.push(Buffer.from(new Uint8Array(arrayBuffer.call(value), byteOffset.call(value), length)))
            size += length; row.bytesRead = size; entity.check()
          }
          page.bodyBase64 = Buffer.concat(chunks, size).toString('base64')
          page.sourceCompletedAt = clock.wall()
          originalClocks(page, null, row)
          entity.check()
        } finally {entity.close()}
      }
      const encoded = page?.bodyBase64
      if (typeof encoded === 'string' && encoded.length > Math.ceil(byteBudget() / 3) * 4) throw fail('original entity byte budget exceeded')
      if (typeof encoded !== 'string' || !encoded || encoded.length % 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) throw fail('original entity bytes are missing or malformed')
      const bytes = Buffer.from(encoded, 'base64')
      assertBytes(bytes.length)
      if (bytes.toString('base64') !== encoded) throw fail('original bytes have noncanonical encoding')
      const digest = sha(bytes)
      Object.assign(row, {bodyBase64: encoded, bytes: bytes.length, sha256: digest, bodyComplete: true})
      const receipt = page.originalReceipt
      if (receipt && (receipt.status !== row.status || receipt.requestedUrl !== url || receipt.finalUrl !== url
        || receipt.bytes !== bytes.length || receipt.sha256 !== digest
        || receipt.headers && JSON.stringify(headersOf(receipt.headers)) !== JSON.stringify(row.headers))) throw fail('original receipt contradicts supplied entity')
      if (page.sha256 != null && page.sha256 !== digest || page.bytes != null && page.bytes !== bytes.length) throw fail('original entity hash or byte metadata contradicts supplied bytes')
      const httpDates = [page.sourceHttpDate, receipt?.sourceHttpDate, header(row.headers, 'date')].filter(value => value != null)
      if (httpDates.some(value => value !== httpDates[0])) throw fail('original response HTTP date contradicts receipt')
      let body
      try {body = new TextDecoder('utf-8', {fatal: true}).decode(bytes)} catch {throw fail('original entity is not valid UTF8')}
      if (['html', 'text', 'body'].some(key => typeof page[key] === 'string' && page[key] !== body)) throw fail('decoded text contradicts original entity bytes')
      request.check()
      row.transportQualified = row.acquisitionClocksComplete
      audit.decodedBytes += bytes.length
      audit.rawPages.push({url, phase, html: body, bodyBase64: encoded, bytes: bytes.length, sha256: digest,
        status: row.status, headers: structuredClone(row.headers), sourceRequestedAt: row.sourceRequestedAt,
        sourceCompletedAt: row.sourceCompletedAt, requestedAt: row.requestedAt, completedAt: row.completedAt,
        originalReceipt: row.originalReceipt, provenance: row.provenance, transportQualified: row.transportQualified})
      row.observedCompletedAt = clock.wall(); request.check(); complete = true
      return {body, sha256: digest, qualified: row.transportQualified}
    } catch (error) {
      readError = error
      if (caller?.aborted) throw caller.reason
      throw error
    } finally {
      request.close()
      if (reader) {if (complete) release(reader); else cancelReader(reader, readError)}
      else cancelBody(response, readError)
      if (row.observedCompletedAt === null) row.observedCompletedAt = safeWall()
    }
  }
  const deliver = async (name, value) => {
    if (!options[name]) return
    const callback = scope(name, bounds.callbackTimeoutMs, source)
    try {await callback.wait(() => options[name](structuredClone(value), {signal: callback.signal, throwIfAborted: callback.check}))}
    finally {callback.close()}
  }
  let auditAttempted = false
  try {
    source.check()
    await operation({read, audit, fail, check: source.check})
    source.check()
    audit.observedRecordCount = audit.observations.length
    await deliver('onMetadata', {source: config.source, companyName: config.company, companyCareerPage: config.entry,
      runtimeInventoryVerification: false, verifiedAt: null, sourceScopeComplete: false, sourceListingComplete: false,
      verifiedPublicJobCount: null, verifiedIndiaJobCount: null, lifecycleCleanupAllowed: false})
    await deliver('onRecords', [])
    audit.completedAt = clock.wall(); audit.inventoryEvidence = gap()
    auditAttempted = true
    await deliver('onAudit', audit)
    source.check()
    const jobs = attachInventoryEvidence([], gap())
    attachSourceObservationEvidence(jobs, {source: config.source, recordKind: 'hiring-signals', observedRecordCount: audit.observations.length,
      observedVacancyCount: 0, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null})
    const retained = structuredClone(audit)
    Object.defineProperties(jobs, {nativeCollectionEvidence: {value: retained, configurable: true}, sourceAudit: {value: retained}})
    return jobs
  } catch (error) {
    if (caller?.aborted) throw caller.reason
    audit.outcome = 'failed'; audit.completedAt = safeWall(); audit.inventoryEvidence = gap()
    audit.observedRecordCount = audit.observations.length
    // Opaque reasons are not coerced or assigned metadata. Supplied setters
    // never run; only errors created in this source receive data properties.
    audit.issues.push({kind: 'public-context-failed', code: object(error) && ownedErrors.has(error) ? error.code : null})
    if (!auditAttempted) {auditAttempted = true; try {await deliver('onAudit', audit)} catch {}}
    if (caller?.aborted) throw caller.reason
    if (object(error) && ownedErrors.has(error)) {
      const retained = structuredClone(audit)
      for (const [key, value] of Object.entries({inventoryEvidence: gap(), nativeCollectionEvidence: retained, sourceAudit: retained})) {
        ignore(() => Object.defineProperty(error, key, {value, configurable: true}))
      }
    }
    throw error
  } finally {source.close()}
}
