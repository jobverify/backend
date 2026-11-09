import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {activeHead, readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

export const PUBLIC_HOME_URL = 'https://3edge.com/'
export const THREE_EDGE_METADATA = Object.freeze({source: '3edge', companyName: '3Edge Technologies',
  companyDomain: '3edge.com', companyCareerPage: PUBLIC_HOME_URL, countryFilter: 'India',
  atsPlatform: 'unqualified-corporate-homepage', paginationStrategy: 'configured-homepage-diagnostic-only',
  extractionStrategy: 'original-public-response-and-unresolved-recruiting-declarations',
  verifiedAt: null, verifiedOn: null, verifiedPublicJobCount: null, verifiedIndiaJobCount: null,
  runtimeInventoryVerification: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
  zeroResultPolicy: 'coverage-gap'})

const typedArray = Object.getPrototypeOf(Uint8Array.prototype)
const intrinsic = name => Object.getOwnPropertyDescriptor(typedArray, name).get
const byteLength = intrinsic('byteLength'), byteOffset = intrinsic('byteOffset'), arrayBuffer = intrinsic('buffer')
const ignore = operation => {try {Promise.resolve(operation()).catch(() => {})} catch {}}
const header = (headers, name) => typeof headers?.get === 'function' ? headers.get(name)
  : Object.entries(headers || {}).find(([key]) => key.toLowerCase() === name)?.[1] ?? null
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const publisherTitle = /^3Edge Technologies: When it comes down to IT$/i
const recruiting = /\b(?:careers?|jobs?|vacanc(?:y|ies)|join us|open positions?|current openings?|apply now|hiring)\b|lever\.co|greenhouse\.io|myworkdayjobs|smartrecruiters|ashbyhq\.com|darwinbox|peoplestrong/i

// Attach abort handlers before creating any task, including reader.read(). A
// synchronous stream pull can abort and throw before its returned promise runs.
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

const controls = options => {
  const limit = (name, fallback, maximum, minimum = 1) => {
    const value = options[name] ?? fallback
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw RangeError('3Edge invalid ' + name + ' limit')
    return value
  }
  const requestTimeoutMs = limit('requestTimeoutMs', options.timeoutMs ?? 15000, 30000)
  const result = {requestTimeoutMs, entityTimeoutMs: limit('entityTimeoutMs', requestTimeoutMs, 30000),
    sourceTimeoutMs: limit('sourceTimeoutMs', options.collectionTimeoutMs ?? 60000, 180000),
    callbackTimeoutMs: limit('callbackTimeoutMs', 10000, 30000),
    maxResponseBytes: limit('maxResponseBytes', 2 * 1024 * 1024, 16 * 1024 * 1024),
    maxSourceBytes: limit('maxSourceBytes', 8 * 1024 * 1024, 32 * 1024 * 1024),
    maxTotalBytes: limit('maxTotalBytes', 8 * 1024 * 1024, 32 * 1024 * 1024),
    maxRequests: limit('maxRequests', 1, 128), maxPages: limit('maxPages', 1, 128)}
  if (options.maxJobs != null) limit('maxJobs', 0, 1000000, 0)
  for (const name of ['fetchPage', 'fetchImpl', 'fetchText', 'onMetadata', 'onAudit', 'onRecords', 'now', 'monotonicNow']) {
    if (options[name] !== undefined && typeof options[name] !== 'function') throw TypeError('3Edge invalid ' + name + ' callback or clock')
  }
  if (options.heldHosts !== undefined && !(options.heldHosts instanceof Set)) throw TypeError('3Edge invalid heldHosts control')
  return result
}

const clocks = options => {
  const wall = () => {
    const value = options.now ? options.now() : new Date()
    if (!(value instanceof Date) && typeof value !== 'string' && typeof value !== 'number') throw RangeError('3Edge invalid source clock')
    const date = new Date(value)
    if (value === '' || !Number.isFinite(date.getTime())) throw RangeError('3Edge invalid source clock')
    return date.toISOString()
  }
  let last = -1
  const monotonic = () => {
    const value = options.monotonicNow ? options.monotonicNow() : performance.now()
    if (!Number.isFinite(value) || value < 0 || value < last) throw RangeError('3Edge invalid monotonic clock')
    last = value
    return value
  }
  const startedAt = wall()
  monotonic()
  return {wall, monotonic, startedAt}
}

const javascriptTypes = new Set(['application/ecmascript', 'application/javascript', 'application/x-ecmascript',
  'application/x-javascript', 'text/ecmascript', 'text/javascript', 'text/javascript1.0', 'text/javascript1.1',
  'text/javascript1.2', 'text/javascript1.3', 'text/javascript1.4', 'text/javascript1.5', 'text/jscript',
  'text/livescript', 'text/x-ecmascript', 'text/x-javascript'])
const scriptType = attrs => Object.hasOwn(attrs, 'type') ? attrs.type.trim().toLowerCase()
  : attrs.language?.trim() ? 'text/' + attrs.language.trim().toLowerCase() : ''
const executableScript = attrs => {
  const type = scriptType(attrs)
  return type === 'module' || (!Object.hasOwn(attrs, 'nomodule') && (type === '' || javascriptTypes.has(type)))
}

// The shared tree retains hidden subtrees even though its public nodes/text
// queries filter them for visible content. Browser script/frame loading and
// JSON-LD publication do not depend on CSS visibility, aria-hidden or inert.
// Keep the parser's token/first-attribute rules and structural boundaries; only
// HTML nodes (including real foreign-content integration points) qualify here.
const browserDeclarationNodes = root => {
  const result = []
  const visit = (node, inherited = 'html', parent) => {
    if (!node || node.nativeTagUnqualified) return
    if (inherited === 'svg' && ['foreignobject', 'desc', 'title'].includes(parent?.tag)) inherited = 'html'
    if (inherited === 'mathml' && (parent?.tag === 'annotation-xml' && /^(?:text\/html|application\/xhtml\+xml)$/i.test(parent.attrs.encoding?.trim() || '')
      || ['mi', 'mo', 'mn', 'ms', 'mtext'].includes(parent?.tag) && !['mglyph', 'malignmark'].includes(node.tag))) inherited = 'html'
    const namespace = inherited === 'html' ? node.tag === 'svg' ? 'svg' : node.tag === 'math' ? 'mathml' : 'html' : inherited
    if (namespace === 'html' && ['template', 'object'].includes(node.tag)) return
    if (namespace === 'html' && ['script', 'iframe'].includes(node.tag)) result.push(node)
    for (const child of node.children) if (typeof child !== 'string') visit(child, namespace, node)
  }
  visit(root)
  return result
}

const discover = html => {
  const doc = readNativeDocument(html), observations = [], seen = new Set()
  const add = (kind, fields) => {
    const key = kind + ':' + (fields.url ?? fields.text ?? '')
    if (!seen.has(key)) {seen.add(key); observations.push({kind, ...fields, enumerated: false, vacancyCount: null,
      sourceScopeComplete: false, lifecycleCleanupAllowed: false})}
  }
  const declared = (kind, value, text = '') => {
    if (!recruiting.test(value + ' ' + text)) return
    let url = null
    try {url = new URL(value, PUBLIC_HOME_URL).href} catch {}
    add(kind, {url, declaredValue: value, text, followed: false})
  }
  for (const node of doc.nodes(node => ['a', 'area'].includes(node.tag) && node.attrs.href)) declared('declared-link', node.attrs.href, doc.text(node))
  const root = doc.nodes(node => node.tag === 'root')[0]
  const visibleScripts = new Set(doc.nodes(node => node.tag === 'script'))
  for (const node of browserDeclarationNodes(root)) {
    if (node.tag === 'iframe' && !Object.hasOwn(node.attrs, 'srcdoc') && node.attrs.src) declared('declared-frame', node.attrs.src)
    if (node.tag !== 'script') continue
    if (node.attrs.src && executableScript(node.attrs)) declared('declared-script', node.attrs.src)
    if (!node.attrs.src && (visibleScripts.has(node) || executableScript(node.attrs) || scriptType(node.attrs) === 'application/ld+json')
      && /\bJobPosting\b/i.test(node.raw || '')) add('jobposting-marker', {marker: 'JobPosting', parsedAsVacancy: false})
  }
  if (doc.nodes(node => /JobPosting/i.test(node.attrs.itemtype || '')).length) add('jobposting-marker', {marker: 'JobPosting', parsedAsVacancy: false})
  const text = root ? doc.text(root) : ''
  if (recruiting.test(text)) add('hiring-signal', {text: text.slice(0, 2000)})
  return observations
}

// This configured corporate document has no enumerated inventory contract.
// Even a newly declared careers/native lead remains unresolved until enumerated.
export const run3EdgePublicRead = async (options = {}) => {
  const caller = options.signal
  caller?.throwIfAborted()
  const bounds = controls(options), clock = clocks(options), heldHosts = options.heldHosts ?? new Set()
  const audit = {source: '3edge', startedAt: clock.startedAt, completedAt: null, outcome: 'coverage-gap', bounds,
    responses: [], rawPages: [], observations: [], issues: [], sourceScopeComplete: false,
    nativeReportedTotal: null, nativeIndiaTotal: null, companyGlobalTotal: null, companyIndiaTotal: null,
    lifecycleCleanupAllowed: false, inventoryVerifiedAt: null, redirectsFollowed: false,
    corporateJavaScriptExecuted: false, subresourcesRequested: false, decodedBytes: 0}
  let firstParty = false
  const gap = () => ({status: 'coverage-gap', surface: PUBLIC_HOME_URL, firstParty, listingComplete: false,
    pagesFetched: audit.responses.filter(row => row.transportQualified && row.bodyComplete).length,
    reportedTotal: null, indiaFacetCount: null, verifiedAt: null,
    reason: 'Configured corporate homepage discovery only; public recruiting leads are not enumerated. Native, company and India vacancy totals remain unknown.'})
  const failure = (message, details = {}) => Object.assign(Error('3Edge ' + message, details.cause ? {cause: details.cause} : undefined), {
    source: '3edge', threeEdgePublicReadFailure: true, softFailure: true, abortRetries: true,
    lifecycleCleanupAllowed: false, failureKind: 'source_inventory_unavailable', ...details, inventoryEvidence: gap()})
  const scope = (kind, milliseconds, parent) => {
    const controller = new AbortController(), realStarted = performance.now(), logicalStarted = clock.monotonic()
    const timeout = failure(kind + ' deadline exceeded', {failureKind: 'network_or_timeout'})
    const signal = AbortSignal.any([controller.signal, ...(parent?.signal ? [parent.signal] : []), ...(caller ? [caller] : [])])
    const timer = setTimeout(() => controller.abort(timeout), milliseconds)
    const check = () => {
      caller?.throwIfAborted()
      parent?.check()
      if (!controller.signal.aborted && Math.max(performance.now() - realStarted, clock.monotonic() - logicalStarted) >= milliseconds) controller.abort(timeout)
      signal.throwIfAborted()
    }
    return {signal, check, wait: (operation, disposeLate) => race(operation, signal, check, disposeLate), close: () => clearTimeout(timer)}
  }
  const source = scope('source', bounds.sourceTimeoutMs)
  const cancelled = new WeakSet(), released = new WeakSet()
  const release = reader => {if (reader && !released.has(reader)) {released.add(reader); ignore(() => reader.releaseLock())}}
  const cancelReader = (reader, reason) => {
    if (reader && !cancelled.has(reader)) {cancelled.add(reader); ignore(() => reader.cancel(reason))}
    release(reader)
  }
  const cancelBody = (response, reason) => ignore(() => {
    const body = response?.body
    if (body && !cancelled.has(body)) {cancelled.add(body); return body.cancel(reason)}
  })
  const byteBudget = () => Math.min(bounds.maxResponseBytes, bounds.maxSourceBytes - audit.decodedBytes, bounds.maxTotalBytes - audit.decodedBytes)
  const assertBytes = size => {if (size > byteBudget()) throw failure('decoded body byte budget exceeded')}
  const read = async () => {
    source.check()
    if (heldHosts.has('3edge.com')) throw failure('public host is held after denial; no retry or bypass', {failureKind: 'blocked_or_access_denied'})
    if (audit.responses.length >= bounds.maxRequests || audit.responses.length >= bounds.maxPages) throw failure('public request/page limit exceeded')
    const row = {requestUrl: PUBLIC_HOME_URL, observedRequestedAt: clock.wall(), observedCompletedAt: null,
      status: null, finalUrl: null, headers: {}, bodyBase64: null, bytes: null, sha256: null,
      sourceRequestedAt: null, sourceCompletedAt: null, sourceHttpDate: null, bodyComplete: false, transportQualified: false}
    audit.responses.push(row)
    const request = scope('request', bounds.requestTimeoutMs, source)
    const init = {method: 'GET', redirect: 'manual', credentials: 'omit', signal: request.signal,
      headers: {Accept: 'text/html,application/xhtml+xml;q=0.9', 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)'},
      maxResponseBytes: bounds.maxResponseBytes, throwIfAborted: request.check}
    let response, reader, complete = false, readError
    try {
      let page
      if (options.fetchPage) page = await request.wait(() => options.fetchPage(PUBLIC_HOME_URL, init), cancelBody)
      else if (options.fetchText && !options.fetchImpl) {
        const text = await request.wait(() => options.fetchText(PUBLIC_HOME_URL, init))
        if (typeof text !== 'string') throw failure('legacy decoded text unavailable')
        assertBytes(Buffer.byteLength(text))
        audit.decodedBytes += Buffer.byteLength(text)
        audit.issues.push({kind: 'unqualified-decoded-only-transport', url: PUBLIC_HOME_URL})
        audit.rawPages.push({url: PUBLIC_HOME_URL, originalText: text, bodyBase64: null, transportQualified: false})
        request.check()
        return {html: text, qualified: false}
      } else {
        const sourceRequestedAt = clock.wall()
        response = await request.wait(() => (options.fetchImpl ?? globalThis.fetch)(PUBLIC_HOME_URL, init), cancelBody)
        page = {url: response?.url, status: response?.status, headers: Object.fromEntries(new Headers(response?.headers)),
          bodyBase64: null, sourceRequestedAt, sourceCompletedAt: null}
      }
      request.check()
      const rawIndex = audit.rawPages.length
      audit.rawPages.push(structuredClone(page))
      const originalReceipt = page?.originalReceipt
      Object.assign(row, {status: page?.status ?? null, finalUrl: page?.finalUrl ?? page?.url ?? null,
        headers: structuredClone(page?.headers ?? {}), location: header(page?.headers, 'location'),
        sourceRequestedAt: page?.sourceRequestedAt ?? originalReceipt?.sourceRequestedAt ?? null,
        sourceCompletedAt: page?.sourceCompletedAt ?? originalReceipt?.sourceCompletedAt ?? null,
        sourceHttpDate: page?.sourceHttpDate ?? header(page?.headers, 'date')})
      if ([401, 403, 429, 451].includes(row.status)) heldHosts.add('3edge.com')
      if (row.status !== 200) throw failure('original public document returned HTTP ' + row.status, {status: row.status,
        requestUrl: PUBLIC_HOME_URL, finalUrl: row.finalUrl,
        failureKind: [401, 403, 429, 451].includes(row.status) ? 'blocked_or_access_denied' : 'surface_drift_or_fail_closed'})
      if (page.url !== PUBLIC_HOME_URL || row.finalUrl !== PUBLIC_HOME_URL || page.requestedUrl !== undefined && page.requestedUrl !== PUBLIC_HOME_URL)
        throw failure('original response URL identity is missing or changed', {status: row.status})
      if (!/^(?:text\/html|application\/xhtml\+xml)(?:\s*;|$)/i.test(header(page.headers, 'content-type') || '')) throw failure('original response HTML MIME is unqualified')
      for (const key of ['sourceRequestedAt', 'sourceCompletedAt']) if (row[key] != null && (!Number.isFinite(Date.parse(row[key]))
        || originalReceipt?.[key] != null && row[key] !== originalReceipt[key])) throw failure('invalid or contradictory original source clock')
      if (row.sourceRequestedAt && row.sourceCompletedAt && Date.parse(row.sourceCompletedAt) < Date.parse(row.sourceRequestedAt)) throw failure('invalid original source clock order')
      request.check()
      if (response) {
        const length = header(response.headers, 'content-length')
        if (length != null && (!/^\d+$/.test(length) || Number(length) > byteBudget())) throw failure('declared response byte limit exceeded')
        if (!response.body?.getReader) throw failure('original readable body unavailable')
        const entity = scope('entity', bounds.entityTimeoutMs, request)
        try {
          reader = await entity.wait(() => response.body.getReader(), cancelReader)
          const chunks = []; let size = 0
          for (;;) {
            const {done, value} = await entity.wait(() => reader.read())
            entity.check()
            if (done) break
            if (!types.isUint8Array(value)) throw failure('native response chunk is not a Uint8Array')
            const length = byteLength.call(value)
            assertBytes(size + length)
            chunks.push(Buffer.from(new Uint8Array(arrayBuffer.call(value), byteOffset.call(value), length)))
            size += length; row.bytesRead = size; entity.check()
          }
          entity.check()
          page.bodyBase64 = Buffer.concat(chunks, size).toString('base64')
          page.sourceCompletedAt = clock.wall()
          row.sourceCompletedAt = page.sourceCompletedAt
          audit.rawPages[rawIndex] = structuredClone(page)
        } finally {entity.close()}
      }
      const encoded = page?.bodyBase64
      if (typeof encoded !== 'string' || !encoded || encoded.length % 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) throw failure('original response bytes are missing or malformed')
      if (encoded.length > Math.ceil(byteBudget() / 3) * 4) throw failure('original body byte budget exceeded')
      const bytes = Buffer.from(encoded, 'base64')
      assertBytes(bytes.length)
      if (bytes.toString('base64') !== encoded) throw failure('original body bytes have noncanonical encoding')
      const sha256 = hash(bytes)
      Object.assign(row, {bodyBase64: encoded, bytes: bytes.length, sha256, bodyComplete: true})
      if (originalReceipt && (originalReceipt.status !== row.status || originalReceipt.requestedUrl !== PUBLIC_HOME_URL
        || originalReceipt.finalUrl !== PUBLIC_HOME_URL || originalReceipt.bytes !== bytes.length || originalReceipt.sha256 !== sha256)) throw failure('original response provenance contradicts supplied entity')
      let text
      try {text = new TextDecoder('utf-8', {fatal: true}).decode(bytes)} catch (cause) {throw failure('original body is not valid UTF8', {cause})}
      if (['html', 'text', 'body'].some(key => typeof page[key] === 'string' && page[key] !== text)) throw failure('decoded text contradicts original response bytes')
      request.check()
      if (!activeHead(text).titles.some(title => publisherTitle.test(title))) throw failure('original public document publisher identity changed')
      request.check()
      row.transportQualified = true; firstParty = true; audit.decodedBytes += bytes.length; complete = true
      return {html: text, qualified: true}
    } catch (error) {readError = error; caller?.throwIfAborted(); throw error}
    finally {
      request.close()
      if (reader) {if (!complete) cancelReader(reader, readError); else release(reader)}
      else cancelBody(response, readError)
      row.observedCompletedAt = clock.wall()
    }
  }
  const deliver = async (name, value) => {
    if (!options[name]) return
    const callback = scope(name, bounds.callbackTimeoutMs, source)
    try {await callback.wait(() => options[name](structuredClone(value), {signal: callback.signal, throwIfAborted: callback.check}))}
    finally {callback.close()}
  }
  try {
    let readFailure, readFailed = false
    try {
      const page = await read()
      source.check()
      audit.observations = discover(page.html)
      source.check()
    } catch (error) {
      caller?.throwIfAborted()
      source.check()
      readFailed = true; readFailure = error; audit.outcome = 'failed'
      audit.issues.push({kind: 'public-read-failed', name: error?.name ?? null, message: error?.message ?? String(error)})
    }
    audit.completedAt = clock.wall()
    audit.inventoryEvidence = gap()
    for (const name of ['onMetadata', 'onAudit']) {
      try {await deliver(name, name === 'onMetadata' ? THREE_EDGE_METADATA : audit)}
      catch (error) {
        caller?.throwIfAborted(); source.check()
        if (!readFailed) throw error
        audit.issues.push({kind: 'failure-evidence-delivery-failed', callback: name, message: error?.message ?? String(error)})
      }
    }
    if (readFailed) throw readFailure
    await deliver('onRecords', [])
    source.check()
    const jobs = attachInventoryEvidence([], gap())
    attachSourceObservationEvidence(jobs, {source: '3edge', recordKind: 'hiring-signals',
      observedRecordCount: audit.observations.length, observedVacancyCount: 0, sourceScopeComplete: false,
      companyGlobalTotal: null, companyIndiaTotal: null})
    // Catalog decoration already retains this compatible source-owned audit
    // slot. The normalized count snapshot remains in its WeakMap/Symbol.
    const retainedAudit = structuredClone(audit)
    Object.defineProperties(jobs, {nativeEvidence: {value: retainedAudit},
      nativeCollectionEvidence: {value: retainedAudit, configurable: true},
      metadata: {value: structuredClone(THREE_EDGE_METADATA)}})
    return jobs
  } catch (error) {
    caller?.throwIfAborted()
    audit.outcome = 'failed'
    if (error?.threeEdgePublicReadFailure) {error.inventoryEvidence = gap(); error.nativeEvidence = structuredClone(audit)}
    throw error
  } finally {source.close()}
}
