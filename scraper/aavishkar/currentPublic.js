import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {readNativeDocument, decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const HOME = 'https://aavishkaargroup.com/', CONTACT = 'https://aavishkaargroup.com/contact-us/'
export const AAVISHKAR_PUBLIC_METADATA = Object.freeze({source: 'aavishkar', companyName: 'Aavishkar',
  officialBrandName: 'Aavishkaar Group', companyDomain: 'aavishkaargroup.com', companyCareerPage: HOME,
  countryFilter: 'India', atsPlatform: 'unqualified-corporate-context',
  paginationStrategy: 'configured-homepage-and-active-literal-contact-only',
  extractionStrategy: 'original-corporate-context-and-unresolved-hiring-declarations',
  verifiedAt: null, verifiedOn: null, verifiedPublicJobCount: null, verifiedIndiaJobCount: null,
  runtimeInventoryVerification: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
  zeroResultPolicy: 'coverage-gap'})

const typedArray = Object.getPrototypeOf(Uint8Array.prototype)
const intrinsic = name => Object.getOwnPropertyDescriptor(typedArray, name).get
const byteLength = intrinsic('byteLength'), byteOffset = intrinsic('byteOffset'), arrayBuffer = intrinsic('buffer')
const ignore = operation => {try {Promise.resolve(operation()).catch(() => {})} catch {}}
const header = (headers, name) => typeof headers?.get === 'function' ? headers.get(name)
  : Object.entries(headers || {}).find(([key]) => key.toLowerCase() === name)?.[1] ?? null
const headerPairs = headers => [...new Headers(headers)].sort(([a], [b]) => a.localeCompare(b))
const cloneHeaders = headers => headers instanceof Headers ? Object.fromEntries(headers) : structuredClone(headers ?? {})
const own = (value, key) => {
  try {return value && (typeof value === 'object' || typeof value === 'function') ? Object.getOwnPropertyDescriptor(value, key)?.value : undefined}
  catch {return undefined}
}
const describe = value => typeof own(value, 'message') === 'string' ? own(value, 'message')
  : value === null ? 'null' : ['object', 'function'].includes(typeof value) ? 'Opaque read failure' : String(value)
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const recruiting = /\b(?:careers?|jobs?|vacanc(?:y|ies)|join us|open positions?|current openings?|apply now|hiring)\b|lever\.co|greenhouse\.io|myworkdayjobs|smartrecruiters|ashbyhq\.com|darwinbox|peoplestrong/i

// Race every asynchronous boundary, then check elapsed time again: an ignored
// signal or synchronous overrun cannot outlive its request/source allowance.
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
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw RangeError('Aavishkar invalid ' + name + ' limit')
    return value
  }
  const requestTimeoutMs = limit('requestTimeoutMs', options.timeoutMs ?? 15000, 30000)
  const result = {requestTimeoutMs, entityTimeoutMs: limit('entityTimeoutMs', requestTimeoutMs, 30000),
    sourceTimeoutMs: limit('sourceTimeoutMs', options.collectionTimeoutMs ?? 60000, 180000),
    callbackTimeoutMs: limit('callbackTimeoutMs', 10000, 30000),
    maxResponseBytes: limit('maxResponseBytes', 2 * 1024 * 1024, 16 * 1024 * 1024),
    maxSourceBytes: limit('maxSourceBytes', 8 * 1024 * 1024, 32 * 1024 * 1024),
    maxTotalBytes: limit('maxTotalBytes', 8 * 1024 * 1024, 32 * 1024 * 1024),
    maxRequests: limit('maxRequests', 2, 128), maxPages: limit('maxPages', 2, 128)}
  if (options.maxJobs != null) limit('maxJobs', 0, 1000000, 0)
  for (const name of ['fetchPage', 'fetchImpl', 'fetchText', 'onMetadata', 'onAudit', 'onRecords', 'now', 'monotonicNow']) {
    if (options[name] !== undefined && typeof options[name] !== 'function') throw TypeError('Aavishkar invalid ' + name + ' callback or clock')
  }
  if (options.heldHosts !== undefined && !(options.heldHosts instanceof Set)) throw TypeError('Aavishkar invalid heldHosts control')
  if (options.signal !== undefined && !(options.signal instanceof AbortSignal)) throw TypeError('Aavishkar invalid signal control')
  return result
}

const clocks = options => {
  const wall = () => {
    const value = options.now ? options.now() : new Date()
    if (!(value instanceof Date) && typeof value !== 'string' && typeof value !== 'number') throw RangeError('Aavishkar invalid source clock')
    const date = new Date(value)
    if (value === '' || !Number.isFinite(date.getTime())) throw RangeError('Aavishkar invalid source clock')
    return date.toISOString()
  }
  let last = -1
  const monotonic = () => {
    const value = options.monotonicNow ? options.monotonicNow() : performance.now()
    if (!Number.isFinite(value) || value < 0 || value < last) throw RangeError('Aavishkar invalid monotonic clock')
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

// CSS visibility is separate from declaration activity. The parser retains
// hidden subtrees; walk those directly while preserving its lexical/raw-text
// boundaries, templates, foreign namespaces and conservative object fallback.
const declarationNodes = root => {
  const result = []
  const visit = (node, inherited = 'html', parent) => {
    if (!node || node.nativeTagUnqualified) return
    if (inherited === 'svg' && ['foreignobject', 'desc', 'title'].includes(parent?.tag)) inherited = 'html'
    if (inherited === 'mathml' && (parent?.tag === 'annotation-xml' && /^(?:text\/html|application\/xhtml\+xml)$/i.test(parent.attrs.encoding?.trim() || '')
      || ['mi', 'mo', 'mn', 'ms', 'mtext'].includes(parent?.tag) && !['mglyph', 'malignmark'].includes(node.tag))) inherited = 'html'
    const namespace = inherited === 'html' ? node.tag === 'svg' ? 'svg' : node.tag === 'math' ? 'mathml' : 'html' : inherited
    if (namespace === 'html' && ['template', 'object'].includes(node.tag)) return
    if (namespace === 'html') result.push(node)
    for (const child of node.children) if (typeof child !== 'string') visit(child, namespace, node)
  }
  visit(root)
  return result
}

// Walk enclosing tag, comment and raw-text boundaries before considering an
// integration spelling. A literal candidate must not consume later real tags.
// Attribute names/values and SVG raw-name handling follow the existing shared
// reader's lexical subset; this is not a browser namespace/conformance parser.
const hasSelfClosingMathIntegration = html => {
  const space = char => char !== undefined && /[\t\n\f\r ]/.test(char)
  const integrations = new Set(['mtext', 'mi', 'mo', 'mn', 'ms', 'annotation-xml'])
  const raw = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'plaintext', 'noscript'])
  const voids = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
  const stack = [{tag: 'root', namespace: 'html'}]
  let cursor = 0
  while ((cursor = html.indexOf('<', cursor)) !== -1) {
    if (html.startsWith('<!--', cursor)) {
      const end = html.indexOf('-->', cursor + 4)
      cursor = end === -1 ? html.length : end + 3
      continue
    }
    if (html.startsWith('<?', cursor) || html.startsWith('<!', cursor)) {
      const end = html.indexOf('>', cursor + 2)
      cursor = end === -1 ? html.length : end + 1
      continue
    }
    let first = cursor + 1
    const closing = html[first] === '/'
    if (closing) first++
    if (!/[a-z]/i.test(html[first] || '')) {cursor++; continue}
    let end = first
    while (end < html.length && !space(html[end]) && !['/', '>'].includes(html[end])) end++
    const tag = html.slice(first, end).replace(/[A-Z]/g, char => char.toLowerCase())
    cursor = end
    let selfClosing = false
    while (cursor < html.length) {
      if (html[cursor] === '/' && html[cursor + 1] === '>') {selfClosing = true; cursor += 2; break}
      if (space(html[cursor]) || html[cursor] === '/') {cursor++; continue}
      if (html[cursor] === '>') {cursor++; break}
      if (html[cursor] === '=') cursor++
      while (cursor < html.length && !space(html[cursor]) && !['/', '=', '>'].includes(html[cursor])) cursor++
      while (space(html[cursor])) cursor++
      if (html[cursor] === '=') {
        cursor++
        while (space(html[cursor])) cursor++
        if (html[cursor] === '"' || html[cursor] === "'") {
          const quote = html[cursor++], end = html.indexOf(quote, cursor)
          if (end === -1) return true
          cursor = end + 1
        } else while (cursor < html.length && !space(html[cursor]) && html[cursor] !== '>') cursor++
      }
    }
    if (closing) {
      const at = stack.findLastIndex(node => node.tag === tag)
      const template = stack.findLastIndex(node => node.tag === 'template')
      if (at > 0 && at >= template) stack.length = at
      continue
    }
    if (integrations.has(tag) && selfClosing) return true
    const parent = stack.at(-1), inherited = parent.namespace
    const integration = inherited === 'svg' && ['foreignobject', 'desc', 'title'].includes(parent.tag)
    const namespace = tag === 'svg' ? 'svg' : integration ? 'html' : inherited
    if (namespace === 'svg' && selfClosing) continue
    if (raw.has(tag) && !(namespace === 'svg' && tag === 'title')) {
      if (tag === 'plaintext') {cursor = html.length; continue}
      const close = new RegExp('</' + tag + '[\\t\\n\\f\\r ]*>', 'ig')
      close.lastIndex = cursor
      const found = close.exec(html)
      cursor = found ? close.lastIndex : html.length
    } else if (!voids.has(tag)) stack.push({tag, namespace})
  }
  return false
}

// The shared tree is not a browser-conformance authority for these spellings.
// Screen the original document before granting any declaration authority. This
// deliberately excludes a document even if a matching spelling might be inert;
// its complete original bytes remain retained as unqualified corporate context.
const declarationQualification = html => {
  const reasons = []
  // A hexadecimal ampersand can become another reference in a later decoder
  // pass. A decimal ampersand can similarly introduce a named reference, even
  // when part of that name was itself encoded. Ordinary query separators such
  // as &#038;format=xml and direct numeric hyphens remain in the supported subset.
  if (/&#x0*26;/i.test(html) || /&#0*38;(?=(?:[a-z]|&#(?:x[\da-f]+|\d+);)+;)/i.test(html)) {
    reasons.push('ambiguous-character-reference-spelling')
  }
  // The shared tree loses MathML self-closing acknowledgement. Attribute-name
  // quotes must not hide a self-close; quoted values retain > and /> as data.
  if (/<math(?=[\t\n\f\r />])/i.test(html) && hasSelfClosingMathIntegration(html)) {
    reasons.push('unsupported-self-closing-MathML-integration-spelling')
  }
  return {profile: 'aavishkar-conservative-html-declarations-v1', qualified: reasons.length === 0, reasons,
    interpretation: 'Document-wide conservative spelling screen; excluded originals are context only. Shared tree, entity and browser equivalence are not certified.'}
}

const discover = (html, documentUrl) => {
  const doc = readNativeDocument(html), root = doc.nodes(node => node.tag === 'root')[0]
  const qualification = declarationQualification(html), structuralNodes = declarationNodes(root)
  const nodes = qualification.qualified ? structuralNodes : [], observations = [], declarations = [], seen = new Set()
  const active = new Set(nodes)
  const declarationText = node => !active.has(node) || ['script', 'style'].includes(node.tag) ? ''
    : decodeNativeEntities(node.children.map(child => typeof child === 'string' ? child : declarationText(child)).join(' ')).replace(/\s+/g, ' ').trim()
  const firstBase = nodes.find(node => node.tag === 'base' && Object.hasOwn(node.attrs, 'href'))
  let base = documentUrl
  if (firstBase) {try {base = new URL(firstBase.attrs.href, documentUrl).href} catch {}}
  const resolve = value => {try {return new URL(value, base).href} catch {return null}}
  const add = (kind, fields) => {
    const key = kind + ':' + (fields.url ?? fields.text ?? '')
    if (!seen.has(key)) {seen.add(key); observations.push({kind, ...fields, documentUrl,
      enumerated: false, vacancyCount: null, sourceScopeComplete: false, lifecycleCleanupAllowed: false})}
  }
  const declared = (kind, value, text = '') => {
    const url = resolve(value)
    declarations.push({kind, declaredValue: value, url, documentUrl, documentBase: base, followed: false})
    if (recruiting.test(value + ' ' + text)) add(kind, {url, declaredValue: value, text, followed: false})
  }
  for (const node of nodes) {
    if (['a', 'area'].includes(node.tag) && node.attrs.href) declared('declared-link', node.attrs.href,
      [declarationText(node), node.attrs['aria-label'], node.attrs.title].filter(Boolean).join(' '))
    if (node.tag === 'iframe' && !Object.hasOwn(node.attrs, 'srcdoc') && node.attrs.src) declared('declared-frame', node.attrs.src)
    if (node.tag === 'script') {
      if (node.attrs.src && executableScript(node.attrs)) declared('declared-script', node.attrs.src)
      if (!node.attrs.src && (executableScript(node.attrs) || scriptType(node.attrs) === 'application/ld+json')
        && /\bJobPosting\b/i.test(node.raw || '')) add('jobposting-marker', {marker: 'JobPosting', parsedAsVacancy: false})
    }
    if (/\bJobPosting\b/i.test(node.attrs.itemtype || '')) add('jobposting-marker', {marker: 'JobPosting', parsedAsVacancy: false})
  }
  const text = qualification.qualified && root ? doc.text(root) : ''
  if (recruiting.test(text)) add('hiring-signal', {text: text.slice(0, 2000)})
  const title = structuralNodes.filter(node => node.tag === 'title').map(node => (node.raw || '').replace(/\s+/g, ' ').trim())
  const titleMatches = documentUrl === HOME ? title.some(value => /^Aavishkaar Group:\s*One of the largest Impact Platforms across the Global South$/i.test(value))
    : title.some(value => /^Contact Us\s*-\s*Aavishkaar Group$/i.test(value))
  // A contact route is readable only when this actual homepage declares the
  // exact configured URL under its effective base and original authority.
  const contact = documentUrl === HOME && declarations.some(row => row.kind === 'declared-link'
    && row.url === CONTACT && new URL(row.url).origin === new URL(documentUrl).origin)
  return {observations, declarations, contact, titleMatches, qualification, documentBase: qualification.qualified ? base : null}
}

export const runAavishkarPublicRead = async (options = {}) => {
  const sourceStarted = performance.now()
  const bounds = controls(options), caller = options.signal
  caller?.throwIfAborted()
  const clock = clocks(options), heldHosts = options.heldHosts ?? new Set()
  const audit = {source: 'aavishkar', startedAt: clock.startedAt, completedAt: null, outcome: 'coverage-gap', bounds,
    responses: [], rawPages: [], observations: [], declarations: [], declarationQualification: [], issues: [], sourceScopeComplete: false,
    nativeReportedTotal: null, nativeIndiaTotal: null, companyGlobalTotal: null, companyIndiaTotal: null,
    lifecycleCleanupAllowed: false, inventoryVerifiedAt: null, redirectsFollowed: false,
    corporateJavaScriptExecuted: false, subresourcesRequested: false, decodedBytes: 0, heldHosts: [...heldHosts]}
  let firstParty = false
  const gap = () => ({status: 'coverage-gap', surface: HOME, firstParty, listingComplete: false,
    pagesFetched: audit.responses.filter(row => row.transportQualified && row.bodyComplete).length,
    reportedTotal: null, indiaFacetCount: null, verifiedAt: null,
    reason: 'Configured corporate homepage and its active literal business contact are context only. Public hiring leads are unresolved; company, native and India vacancy totals remain unknown.'})
  const failure = (message, details = {}) => Object.assign(Error('Aavishkar ' + message, details.cause ? {cause: details.cause} : undefined), {
    source: 'aavishkar', aavishkarPublicReadFailure: true, softFailure: true, abortRetries: true,
    lifecycleCleanupAllowed: false, failureKind: 'source_inventory_unavailable', ...details, inventoryEvidence: gap()})
  const scope = (kind, milliseconds, parent) => {
    const controller = new AbortController(), realStarted = kind === 'source' ? sourceStarted : performance.now(), logicalStarted = clock.monotonic()
    const timeout = failure(kind + ' deadline exceeded', {failureKind: 'network_or_timeout'})
    const signal = AbortSignal.any([controller.signal, ...(parent?.signal ? [parent.signal] : []), ...(caller ? [caller] : [])])
    const timer = setTimeout(() => controller.abort(timeout), Math.max(1, milliseconds - (performance.now() - realStarted)))
    const check = () => {
      caller?.throwIfAborted()
      parent?.check()
      if (!controller.signal.aborted && Math.max(performance.now() - realStarted, clock.monotonic() - logicalStarted) >= milliseconds) controller.abort(timeout)
      signal.throwIfAborted()
    }
    return {signal, check, wait: (operation, disposeLate) => race(operation, signal, check, disposeLate), close: () => clearTimeout(timer)}
  }
  const source = scope('source', bounds.sourceTimeoutMs)
  const stampCompletion = (target, key, rejection, scope) => {
    try {target[key] = clock.wall()}
    catch (error) {
      if (!rejection.failed) throw error
      target[key] = null
      // Diagnostic clocks are optional after a read failure. In particular,
      // retrying a once-failing clock would manufacture its missing timestamp.
      try {audit.issues.push({kind: 'completion-clock-unavailable', scope, message: describe(error)})} catch {}
    }
  }
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
  const acquisitionClocks = (page, row) => {
    const receipt = page.originalReceipt
    for (const [sourceKey, requestKey] of [['sourceRequestedAt', 'requestedAt'], ['sourceCompletedAt', 'completedAt']]) {
      const values = [page[sourceKey], page[requestKey], receipt?.[sourceKey], receipt?.[requestKey]].filter(value => value != null)
      if (values.some(value => typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || value !== values[0])) throw failure('invalid or contradictory original acquisition clock')
      row[sourceKey] = values[0] ?? null
      row[requestKey] = page[requestKey] ?? receipt?.[requestKey] ?? null
    }
    if (row.sourceRequestedAt && row.sourceCompletedAt && Date.parse(row.sourceCompletedAt) < Date.parse(row.sourceRequestedAt)) throw failure('invalid original acquisition clock order')
  }
  const read = async url => {
    source.check()
    if (![HOME, CONTACT].includes(url)) throw failure('document was not configured or declared')
    if (heldHosts.has('aavishkaargroup.com') || heldHosts.has('www.aavishkaargroup.com')) throw failure('public host is held after denial; no retry or bypass', {failureKind: 'blocked_or_access_denied'})
    if (audit.responses.length >= bounds.maxRequests || audit.responses.length >= bounds.maxPages) throw failure('public request/page limit exceeded')
    const row = {requestUrl: url, observedRequestedAt: clock.wall(), observedCompletedAt: null,
      status: null, finalUrl: null, headers: {}, bodyBase64: null, bytes: null, sha256: null,
      sourceRequestedAt: null, sourceCompletedAt: null, requestedAt: null, completedAt: null,
      sourceHttpDate: null, bodyComplete: false, transportQualified: false}
    audit.responses.push(row)
    const request = scope('request', bounds.requestTimeoutMs, source)
    const init = {method: 'GET', redirect: 'manual', credentials: 'omit', signal: request.signal,
      headers: {Accept: 'text/html', 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)'},
      maxResponseBytes: bounds.maxResponseBytes, throwIfAborted: request.check}
    let response, reader, complete = false
    const readRejection = {failed: false, value: undefined}
    try {
      let page
      if (options.fetchPage) page = await request.wait(() => options.fetchPage(url, init), cancelBody)
      else if (options.fetchText && !options.fetchImpl) {
        const text = await request.wait(() => options.fetchText(url, init))
        page = {url, html: text}
      } else {
        const sourceRequestedAt = clock.wall()
        response = await request.wait(() => (options.fetchImpl ?? globalThis.fetch)(url, init), cancelBody)
        page = {url: response?.url, status: response?.status, headers: cloneHeaders(response?.headers),
          bodyBase64: null, sourceRequestedAt, sourceCompletedAt: null}
      }
      request.check()
      const rawIndex = audit.rawPages.length
      audit.rawPages.push(structuredClone(page))
      const originalReceipt = page?.originalReceipt
      Object.assign(row, {status: page?.status ?? null, finalUrl: page?.finalUrl ?? page?.url ?? null,
        headers: cloneHeaders(page?.headers), location: header(page?.headers, 'location'),
        sourceHttpDate: page?.sourceHttpDate ?? header(page?.headers, 'date')})
      // Retain rejected status/headers before accessing or parsing the entity.
      if ([401, 403, 429, 451].includes(row.status)) {heldHosts.add('aavishkaargroup.com'); audit.heldHosts = [...heldHosts]}
      acquisitionClocks(page ?? {}, row)
      if (row.status != null && row.status !== 200) throw failure('original public document returned HTTP ' + row.status, {status: row.status,
        requestUrl: url, finalUrl: row.finalUrl,
        failureKind: [401, 403, 429, 451].includes(row.status) ? 'blocked_or_access_denied' : 'surface_drift_or_fail_closed'})
      if (page?.url !== url || row.finalUrl !== url || page.requestedUrl !== undefined && page.requestedUrl !== url) throw failure('original response URL identity is missing or changed')
      const mime = header(page.headers, 'content-type')
      // This declaration reader uses HTML case and namespace rules. XML/XHTML
      // needs a separately qualified parser and cannot authorize another GET.
      if (mime != null && !/^text\/html(?:\s*;|$)/i.test(mime)) throw failure('original response HTML MIME is unqualified')
      if (!response && page.bodyBase64 === undefined && typeof page.html === 'string') {
        assertBytes(Buffer.byteLength(page.html))
        audit.decodedBytes += Buffer.byteLength(page.html)
        audit.issues.push({kind: 'unqualified-decoded-only-transport', url})
        request.check()
        return {html: page.html, qualified: false}
      }
      if (row.status !== 200) throw failure('original response status is unavailable')
      if (mime == null) throw failure('original response HTML MIME is unqualified')
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
          acquisitionClocks(page, row)
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
      if (page.bytes != null && page.bytes !== bytes.length || page.sha256 != null && page.sha256 !== sha256) throw failure('supplied entity provenance contradicts original response bytes')
      if (originalReceipt && (originalReceipt.status !== row.status || originalReceipt.requestedUrl !== url
        || originalReceipt.finalUrl !== url || originalReceipt.bytes !== bytes.length || originalReceipt.sha256 !== sha256
        || JSON.stringify(headerPairs(originalReceipt.headers)) !== JSON.stringify(headerPairs(page.headers)))) throw failure('original response provenance contradicts supplied entity')
      const httpDates = [page.sourceHttpDate, originalReceipt?.sourceHttpDate, header(page.headers, 'date')].filter(value => value != null)
      if (httpDates.some(value => value !== httpDates[0])) throw failure('original response HTTP date contradicts supplied headers')
      let text
      try {text = new TextDecoder('utf-8', {fatal: true}).decode(bytes)} catch (cause) {throw failure('original body is not valid UTF8', {cause})}
      if (['html', 'text', 'body'].some(key => typeof page[key] === 'string' && page[key] !== text)) throw failure('decoded text contradicts original response bytes')
      request.check()
      row.transportQualified = true; firstParty = true; audit.decodedBytes += bytes.length; complete = true
      return {html: text, qualified: true}
    } catch (error) {
      readRejection.failed = true; readRejection.value = error
      caller?.throwIfAborted()
      throw readRejection.value
    }
    finally {
      request.close()
      if (reader) {if (!complete) cancelReader(reader, readRejection.value); else release(reader)}
      else cancelBody(response, readRejection.value)
      stampCompletion(row, 'observedCompletedAt', readRejection, 'response')
    }
  }
  const deliver = async (name, value) => {
    if (!options[name]) return
    const callback = scope(name, bounds.callbackTimeoutMs, source)
    try {await callback.wait(() => options[name](structuredClone(value), {signal: callback.signal, throwIfAborted: callback.check}))}
    finally {callback.close()}
  }
  const retainDiscovery = (documentUrl, discovery) => {
    audit.declarationQualification.push({documentUrl, ...discovery.qualification})
    for (const reason of discovery.qualification.reasons) audit.issues.push({kind: 'unqualified-declaration-context',
      documentUrl, reason, contextRetained: true, declarationAuthority: false})
    audit.declarations.push(...discovery.declarations)
    audit.observations.push(...discovery.observations)
  }
  try {
    const readRejection = {failed: false, value: undefined}
    try {
      const homepage = await read(HOME)
      source.check()
      const homeDiscovery = discover(homepage.html, HOME)
      retainDiscovery(HOME, homeDiscovery)
      if (!homeDiscovery.titleMatches) throw failure('original public document publisher identity changed')
      source.check()
      if (homeDiscovery.contact) {
        const contact = await read(CONTACT)
        source.check()
        const contactDiscovery = discover(contact.html, CONTACT)
        retainDiscovery(CONTACT, contactDiscovery)
        if (!contactDiscovery.titleMatches) throw failure('original business contact publisher identity changed')
        for (const row of audit.declarations) if (row.documentUrl === HOME && row.kind === 'declared-link' && row.url === CONTACT) row.followed = true
      }
      source.check()
    } catch (error) {
      caller?.throwIfAborted()
      readRejection.failed = true; readRejection.value = error; audit.outcome = 'failed'
      audit.issues.push({kind: 'public-read-failed', message: describe(error)})
    }
    stampCompletion(audit, 'completedAt', readRejection, 'audit')
    audit.inventoryEvidence = gap()
    for (const name of ['onMetadata', 'onAudit']) {
      try {await deliver(name, name === 'onMetadata' ? AAVISHKAR_PUBLIC_METADATA : audit)}
      catch (error) {
        caller?.throwIfAborted()
        if (!readRejection.failed) throw error
        audit.issues.push({kind: 'failure-evidence-delivery-failed', callback: name, message: describe(error)})
      }
    }
    if (readRejection.failed) throw readRejection.value
    await deliver('onRecords', [])
    source.check()
    const jobs = attachInventoryEvidence([], gap())
    attachSourceObservationEvidence(jobs, {source: 'aavishkar', recordKind: 'hiring-signals',
      observedRecordCount: audit.observations.length, observedVacancyCount: 0, sourceScopeComplete: false,
      companyGlobalTotal: null, companyIndiaTotal: null})
    // The real catalog retains this source-owned full audit beside the bounded
    // observation attachment. No callback is needed to retain the originals.
    const retainedAudit = structuredClone(audit)
    Object.defineProperties(jobs, {nativeCollectionEvidence: {value: retainedAudit, configurable: true},
      sourceAudit: {value: retainedAudit}, nativeEvidence: {value: retainedAudit},
      metadata: {value: structuredClone(AAVISHKAR_PUBLIC_METADATA)}})
    return jobs
  } catch (error) {
    caller?.throwIfAborted()
    audit.outcome = 'failed'
    // Never assign into an arbitrary Error: frozen/opaque/falsy reasons retain
    // identity, and inherited or own setters cannot consume diagnostics.
    try {
      if (error && typeof error === 'object' && Object.isExtensible(error)) {
        for (const [key, value] of Object.entries({inventoryEvidence: gap(), sourceAudit: structuredClone(audit),
          nativeEvidence: structuredClone(audit), lifecycleCleanupAllowed: false})) {
          const field = Object.getOwnPropertyDescriptor(error, key)
          if (!field || field.configurable && Object.hasOwn(field, 'value')) Object.defineProperty(error, key, {value, configurable: true})
        }
      }
    } catch {}
    throw error
  } finally {source.close()}
}
