import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {types, isDeepStrictEqual} from 'node:util'
import {readJobPosting, nodeText} from '../../scraper-support/native-sources/jobPostingData.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {criteria, plain} from '../../scraper-support/native-sources/declaredJobFeeds/nativeData.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const profile = JSON.parse(readFileSync(new URL('./reviewedNativeText20261115.json', import.meta.url), 'utf8'))
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const clone = value => structuredClone(value)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const allNodes = node => [node, ...node.children.filter(child => typeof child !== 'string').flatMap(allNodes)]
const fail = message => Object.assign(Error('Netomi own native text coverage gap: ' + message), {
  name: 'NetomiNativeTextCoverageError', softFailure: true, failureKind: 'coverage_gap',
  sourceScopeComplete: false, lifecycleCleanupAllowed: false,
})
const need = (condition, message) => {if (!condition) throw fail(message)}
const only = (rows, name) => {need(rows.length === 1, 'Missing or ambiguous ' + name); return rows[0]}
const unavailable = text => /\b(?:this|the) (?:job|role|position|vacancy) (?:is|was|has been) (?:(?:now|currently|already) )?(?:closed|filled|expired|unavailable|on hold)\b|\bno longer accepting applications\b/i.test(text)
export const NETOMI_NATIVE_LIMITS = Object.freeze({maxRequests: 22, sourceTimeoutMs: 45000,
  requestTimeoutMs: 15000, maxEntityBytes: 1048576, maxFeedBytes: 524288,
  maxAggregateBytes: 24000000, pacingMs: 500})

export const admitNetomiEntityBytes = (url, raw) => {
  need(Buffer.isBuffer(raw), 'Original entity bytes are required')
  need(!(raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf), 'Unreviewed UTF8 BOM')
  if (url === profile.feedURL) {
    need(raw.length === profile.fullFeed.bytes && sha(raw) === profile.fullFeed.rawEntitySHA256, 'Unreviewed complete raw full feed')
  } else {
    const contract = profile.htmlEntities[url]
    need(contract && raw.length === contract.originalEntityBytes, 'Unknown or changed whole native HTML entity')
    for (const segment of contract.immutableRawSegments) need(sha(raw.subarray(segment.byteOffset, segment.byteOffset + segment.byteLength)) === segment.immutableRawSegmentSHA256,
      'Changed immutable original HTML/program/style/criteria segment')
    need(contract.slots.length === 3, 'Changed reviewed data-slot cardinality')
    const [ray, timing, mirrored] = contract.slots.map(slot => raw.subarray(slot.byteOffset, slot.byteOffset + slot.byteLength).toString('latin1'))
    need(/^[a-f0-9]{16}$/.test(ray) && mirrored === ray && /^[A-Za-z0-9+/]{14}==$/.test(timing), 'Changed coupled CF data slots')
    const timingASCII = Buffer.from(timing, 'base64').toString('latin1')
    need(/^\d{10}$/.test(timingASCII) && Buffer.from(timingASCII).toString('base64') === timing, 'Changed canonical CF timing data')
  }
  try {return new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(raw)}
  catch {throw fail('Invalid original UTF8')}
}
const feedModel = html => {
  const records = clone(readLiteralModel(html).value)
  need(Array.isArray(records) && records.length === profile.fullFeed.count, 'Unknown full feed inventory')
  need(new Set(records.map(record => record.id)).size === records.length, 'Duplicate native role identity')
  return records
}
const boardModel = (html, feed) => {
  const doc = readNativeDocument(html), nodes = allNodes(only(doc.nodes(node => node.tag === 'root'), 'native root'))
  need(only(nodes.filter(node => node.tag === 'title'), 'board title').raw === 'Netomi', 'Changed native board employer')
  need(nodes.some(node => node.tag === 'a' && node.attrs.href === profile.literalNativeHomepageHref), 'Changed literal native employer backlink')
  const ids = [...new Set(nodes.filter(node => node.tag === 'a' && typeof node.attrs.href === 'string'
    && /^https:\/\/jobs\.lever\.co\/netomi\/[0-9a-f-]{36}$/.test(node.attrs.href)).map(node => node.attrs.href.split('/').at(-1)))].sort()
  need(same(ids, feed.map(record => record.id).sort()), 'Native board/full feed identity conflict')
  return {ids, employerLabel: 'Netomi', literalHomepageHref: profile.literalNativeHomepageHref}
}
const detailModel = (html, record, expected) => {
  const parsed = readJobPosting(html), schema = parsed.candidate?.model
  need(parsed.candidates.length === 1 && !parsed.errors.length && schema, 'Changed native JobPosting carrier')
  const doc = parsed.document, nodes = allNodes(only(doc.nodes(node => node.tag === 'root'), 'role root'))
  need(schema.title === record.text && schema.hiringOrganization?.name === profile.employerLabel
    && schema.hiringOrganization.logo === profile.logoURL, 'Native title/employer/logo conflict')
  need(nodes.some(node => node.tag === 'img' && node.attrs.src === profile.logoURL), 'Original native logo declaration changed')
  need(same(doc.nodes(node => node.tag === 'meta' && node.attrs.property === 'og:url').map(node => node.attrs.content), [record.hostedUrl]), 'Native OG identity changed')
  const canonical = nodes.filter(node => node.tag === 'link' && (node.attrs.rel || '').toLowerCase().split(/\s+/).includes('canonical'))
  need(!canonical.length || canonical.length === 1 && canonical[0].attrs.href === record.hostedUrl, 'Native canonical identity changed')
  need(nodes.some(node => node.tag === 'a' && node.attrs.href === record.applyUrl), 'Literal application identity changed')
  need(record.id === expected.id && record.text === expected.title && record.country === 'IN'
    && same(record.categories, expected.categories) && same(record.categories.allLocations, [record.categories.location])
    && record.hostedUrl === expected.hostedUrl && record.applyUrl === expected.applyUrl, 'Native identity or typed India worksite changed')
  need(record.createdAt === expected.createdAt && Number.isSafeInteger(record.createdAt)
    && schema.datePosted === expected.schemaDatePosted && new Date(record.createdAt).toISOString().slice(0, 10) === schema.datePosted,
  'Native calendar date conflict')
  need(!Object.keys(record).some(key => /expir|valid|status|closed|deadline|listed/i.test(key))
    && !Object.keys(schema).some(key => /valid|expir|status|closed|deadline/i.test(key)), 'Unreviewed date/status/expiry carrier')
  const root = only(doc.nodes(node => node.tag === 'root'), 'authored root'), authoredText = plain(html)
  need(!unavailable(authoredText), 'Explicit closed/filled/expired role notice')
  const parts = [...['opening', 'descriptionBody', 'description', 'openingPlain', 'descriptionBodyPlain', 'descriptionPlain'].map(key => record[key]),
    ...record.lists.flatMap(section => [section.text, section.content]), ...['additional', 'additionalPlain', 'salaryDescription', 'salaryDescriptionPlain'].map(key => record[key])]
    .filter(value => typeof value === 'string' && plain(value))
  need(parts.every(value => plain(schema.description).includes(plain(value)) && authoredText.includes(plain(value))), 'Incomplete rich/plain/schema/authored criteria')
  const ai = only(nodes.filter(node => node.attrs['data-qa'] === 'ai-disclaimer'), 'complete authored AI notice')
  const aiNotice = nodeText(ai)
  need(aiNotice.startsWith('We may use artificial intelligence (AI) tools to support parts of the hiring process'), 'Changed authored AI disclosure')
  const nativeCriteria = criteria({platform: 'lever'}, record)
  need(nativeCriteria && nativeCriteria.length > 100 && parts.length >= 11, 'Substantive original role criteria unavailable')
  return {schema: clone(schema), aiNotice, authoredText: doc.text(root), completeAuthoredText: authoredText,
    jobDescription: nativeCriteria + (nativeCriteria.includes(aiNotice) ? '' : '\n\n' + aiNotice),
    richPlainCarrierCount: parts.length, originalHTML: html}
}

const typedArray = Object.getPrototypeOf(Uint8Array.prototype)
const intrinsic = name => Object.getOwnPropertyDescriptor(typedArray, name).get
const byteLength = intrinsic('byteLength'), byteOffset = intrinsic('byteOffset'), arrayBuffer = intrinsic('buffer')
const ignore = fn => {try {Promise.resolve(fn()).catch(() => {})} catch {}}

export const createNetomiNativeTextScraper = (defaults = {}) => ({name: 'netomi', async run(passed = {}) {
  const options = {...defaults, ...passed}, caller = options.signal
  caller?.throwIfAborted()
  need(!options.fetchText && !options.fetchJson && !options.fetchPage, 'Full original Response transport required')
  const limits = {}
  for (const [key, maximum] of Object.entries(NETOMI_NATIVE_LIMITS)) {
    if (key === 'pacingMs') {limits[key] = maximum; continue}
    const value = options[key] === undefined ? maximum : options[key]
    need(Number.isSafeInteger(value) && value >= 1 && value <= maximum, 'Invalid reduced ' + key)
    limits[key] = value
  }
  let maxJobs = options.maxJobs === Infinity ? null : options.maxJobs ?? null
  need(maxJobs === null || Number.isSafeInteger(maxJobs) && maxJobs >= 0, 'Invalid maxJobs')
  need(limits.maxRequests >= 4 && limits.maxAggregateBytes >= 3 * 1048576, 'Opening/closing inventory reservation cannot fit')
  const onAudit = options.onAudit ?? (() => {}), onRecords = options.onRecords ?? (() => {})
  need(typeof onAudit === 'function' && typeof onRecords === 'function', 'Invalid audit observer')
  const acquire = options.fetchImpl ?? globalThis.fetch
  need(typeof acquire === 'function', 'Original Response transport unavailable')
  const control = new AbortController(), began = performance.now()
  const sourceTimer = setTimeout(() => control.abort(fail('Source deadline exceeded')), limits.sourceTimeoutMs)
  const source = caller ? AbortSignal.any([caller, control.signal]) : control.signal
  const audit = {source: 'netomi', startedAt: new Date().toISOString(), recordKind: 'vacancy-rows',
    observedRecordCount: 0, observedVacancyCount: 0, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
    corporateBindingQualified: false, formalLegalEntityQualified: false, sourceActivationComplete: false,
    sourceRenderedCriteriaComplete: false, sourceApplicationQualificationComplete: false,
    qualification: 'OWN NATIVE TEXT DATA only; current corporate endorsement, formal legal entity, rendered/application and whole-company scope remain unverified.',
    ownDetailAPIVisited: false, rawPages: [], observations: [], issues: [], limits}
  const check = () => {caller?.throwIfAborted(); if (performance.now() - began >= limits.sourceTimeoutMs && !control.signal.aborted) control.abort(fail('Source deadline exceeded')); source.throwIfAborted()}
  const remaining = () => Math.max(0, limits.sourceTimeoutMs - (performance.now() - began))
  const wait = (operation, signal = source, dispose) => new Promise((resolve, reject) => {
    let settled = false, rejected
    const detach = () => signal.removeEventListener('abort', abort)
    const rejectOnce = reason => {if (!settled) {settled = true; rejected = reason; detach(); reject(reason)}}
    const abort = () => rejectOnce(caller?.aborted ? caller.reason : signal.reason)
    signal.addEventListener('abort', abort, {once: true})
    try {check(); signal.throwIfAborted()} catch (error) {rejectOnce(error); return}
    Promise.resolve().then(() => {check(); signal.throwIfAborted(); return operation()}).then(value => {
      if (settled) {if (dispose) ignore(() => dispose(value, rejected)); return}
      try {check(); signal.throwIfAborted()} catch (error) {rejectOnce(error); if (dispose) ignore(() => dispose(value, error)); return}
      settled = true; detach(); resolve(value)
    }, error => {if (!settled) {try {check(); signal.throwIfAborted()} catch (reason) {error = reason} rejectOnce(error)}})
  })
  const lastStart = new Map(), denied = new Set()
  let aggregateBytes = 0
  const read = async (url, kind, quota = limits.requestTimeoutMs) => {
    check(); need(url === profile.feedURL || Object.hasOwn(profile.htmlEntities, url), 'Unbound native URL')
    const origin = new URL(url).origin
    need(!denied.has(origin) && audit.rawPages.length < limits.maxRequests, 'Denied origin or physical request bound')
    const pause = limits.pacingMs - (performance.now() - (lastStart.get(origin) ?? -Infinity))
    if (pause > 0) await wait(() => new Promise(resolve => {
      const abort = () => clearTimeout(timer)
      const timer = setTimeout(() => {source.removeEventListener('abort', abort); resolve()}, pause)
      source.addEventListener('abort', abort, {once: true})
    }))
    check(); need(quota >= 1, 'Closing time reservation exhausted')
    const deadline = new AbortController(), timeoutMs = Math.max(1, Math.min(limits.requestTimeoutMs, Math.floor(quota), Math.floor(remaining())))
    const timer = setTimeout(() => deadline.abort(fail('Native request deadline exceeded')), timeoutMs)
    const requestSignal = AbortSignal.any([source, deadline.signal])
    const receipt = {index: audit.rawPages.length, kind, url, method: 'GET', startedAt: new Date().toISOString(), bytes: 0, entityComplete: false}
    audit.rawPages.push(receipt); lastStart.set(origin, performance.now())
    let response, reader, completed = false
    const cap = Math.min(limits.maxEntityBytes, kind === 'feed' ? limits.maxFeedBytes : limits.maxEntityBytes)
    const cancel = reason => {if (reader) {ignore(() => reader.cancel(reason)); ignore(() => reader.releaseLock())} else if (response?.body) ignore(() => response.body.cancel(reason))}
    try {
      response = await wait(() => acquire(url, {method: 'GET', redirect: 'manual', credentials: 'omit', signal: requestSignal,
        headers: {Accept: 'text/html,application/json,*/*;q=0.5', 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)'}}), requestSignal, (late, reason) => late.body?.cancel(reason))
      receipt.status = response.status; receipt.responseURL = response.url; receipt.redirected = response.redirected
      if ([401, 403, 429, 451].includes(response.status)) denied.add(origin)
      if (response.status !== 200) {
        const error = fail('Native HTTP ' + response.status)
        Object.assign(error, {status: response.status, requestUrl: url, originDenied: denied.has(origin), failureKind: denied.has(origin) ? 'blocked_or_access_denied' : 'coverage_gap'})
        throw error
      }
      need(response.url === url && response.redirected === false, 'Changed/prefollowed original Response URL')
      const mime = response.headers.get('content-type') ?? ''
      receipt.contentType = mime
      need((kind === 'feed' ? /^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?$/i : /^text\/html(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?$/i).test(mime), 'Unreviewed original MIME/charset')
      need(response.body && typeof response.body.getReader === 'function', 'Original byte stream unavailable')
      reader = await wait(() => response.body.getReader(), requestSignal, (late, reason) => {ignore(() => late.cancel(reason)); ignore(() => late.releaseLock())})
      const chunks = []
      for (;;) {
        const {done, value} = await wait(() => reader.read(), requestSignal)
        if (done) break
        need(types.isUint8Array(value), 'Native byte chunk required')
        const size = byteLength.call(value)
        receipt.bytes += size; aggregateBytes += size
        need(receipt.bytes <= cap && aggregateBytes <= limits.maxAggregateBytes, 'Original entity/aggregate streaming byte bound')
        chunks.push(Buffer.from(new Uint8Array(arrayBuffer.call(value), byteOffset.call(value), size)))
      }
      const raw = Buffer.concat(chunks)
      receipt.entityComplete = true; receipt.originalEntityReviewed = false
      receipt.rawEntitySHA256 = sha(raw); receipt.bodyBase64 = raw.toString('base64')
      const text = admitNetomiEntityBytes(url, raw)
      receipt.originalEntityReviewed = true
      completed = true
      return {text, receipt}
    } catch (error) {
      cancel(error); check()
      receipt.error = error?.message ?? String(error)
      throw error
    } finally {
      clearTimeout(timer)
      if (completed && reader) ignore(() => reader.releaseLock())
      receipt.completedAt = new Date().toISOString()
    }
  }
  const finishAudit = async () => {
    check(); audit.completedAt = new Date().toISOString(); audit.physicalRequests = audit.rawPages.length; audit.originalEntityBytes = aggregateBytes
    await wait(() => onAudit(clone(audit)))
    await wait(() => onRecords(clone(audit.observations)))
    check()
  }
  try {
    let observedAt
    try {observedAt = typeof options.now === 'function' ? options.now() : options.now ?? new Date().toISOString()} finally {check()}
    need(typeof observedAt === 'string' && Number.isFinite(Date.parse(observedAt)), 'Invalid observation clock')
    const openingBoard = await read(profile.boardURL, 'board')
    const openingFeed = await read(profile.feedURL, 'feed'), records = feedModel(openingFeed.text)
    audit.opening = {board: boardModel(openingBoard.text, records), fullNativeFeed: records}
    audit.observedRecordCount = records.length; audit.observedVacancyCount = records.length
    audit.observations = records.map(record => ({id: record.id, sourceNativeRecord: clone(record), sourceNativeDataIdentityQualified: false}))
    const candidates = profile.roles.map(expected => ({expected, record: only(records.filter(record => record.id === expected.id), 'reviewed India native role')}))
    need(candidates.every(({record}) => record.country === 'IN' && record.categories.allLocations.length === 1), 'Changed typed native India scope')
    const capacity = Math.max(0, Math.min(candidates.length, maxJobs ?? candidates.length, Math.floor((limits.maxRequests - 4) / 2), Math.floor((limits.maxAggregateBytes - 3 * 1048576) / (2 * 1048576))))
    const paired = []
    audit.selectedNativeIds = candidates.slice(0, capacity).map(({record}) => record.id)
    for (const {expected, record} of candidates.slice(0, capacity)) {
      check()
      const reserve = 2 * Math.min(15000, Math.floor(remaining() / 4)) + 1000
      const quota = Math.floor((remaining() - reserve - 1000) / 2)
      if (quota < 1) {audit.issues.push({id: record.id, issue: 'Closing time reservation requires stopping selection'}); break}
      const row = audit.observations.find(row => row.id === record.id)
      try {
        const first = await read(record.hostedUrl, 'role', quota), opened = detailModel(first.text, record, expected)
        row.opening = {...opened, originalEntitySHA256: first.receipt.rawEntitySHA256}
        const second = await read(record.hostedUrl, 'role', Math.min(quota, remaining() - reserve)), closed = detailModel(second.text, record, expected)
        row.closing = {...closed, originalEntitySHA256: second.receipt.rawEntitySHA256}
        need(isDeepStrictEqual(opened.schema, closed.schema) && opened.jobDescription === closed.jobDescription
          && opened.completeAuthoredText === closed.completeAuthoredText && opened.aiNotice === closed.aiNotice, 'Closing native qualification/criteria drift')
        row.sourceNativeDataIdentityQualified = true; paired.push({record, detail: opened, hashes: [first.receipt.rawEntitySHA256, second.receipt.rawEntitySHA256]})
      } catch (error) {check(); if (error?.originDenied) throw error; row.issue = error?.message ?? String(error); audit.issues.push({id: record.id, issue: row.issue})}
    }
    const closingBoard = await read(profile.boardURL, 'board', Math.floor((remaining() - 500) / 2))
    const closingFeed = await read(profile.feedURL, 'feed', remaining()), finalRecords = feedModel(closingFeed.text)
    audit.closing = {board: boardModel(closingBoard.text, finalRecords), fullNativeFeed: finalRecords}
    need(isDeepStrictEqual(audit.opening, audit.closing), 'Closing complete native inventory/qualification drift')
    audit.nativeInventoryPairComplete = true
    audit.openingHydratedNativeRecordCount = audit.observations.filter(row => row.opening).length
    audit.qualifiedNativeRecordCount = paired.length
    // Planned selection does not establish a complete, stable native role pair.
    audit.unhydratedNativeRecordCount = records.length - paired.length
    const jobs = paired.map(({record, detail, hashes}) => {
      const address = detail.schema.jobLocation?.address ?? {}
      return {source: 'netomi', company: 'Netomi', companyName: 'Netomi', officialBrandName: 'Netomi', title: record.text,
        jobId: record.id, requisitionId: record.id, sourceUrl: record.hostedUrl, applyUrl: record.applyUrl, link: record.applyUrl,
        country: 'India', countryCode: record.country, location: record.categories.location,
        city: /remote/i.test(address.addressLocality ?? '') ? null : address.addressLocality ?? null, state: address.addressRegion ?? null,
        department: record.categories.team || record.categories.department, jobDescription: detail.jobDescription, sourceDescription: detail.jobDescription,
        employmentType: detail.schema.employmentType, remoteStatus: record.workplaceType === 'remote' ? 'Remote' : null,
        postingDate: new Date(record.createdAt).toISOString(), sourcePostingDate: record.createdAt, sourcePostingDatePrecision: 'native-createdAt-milliseconds',
        sourceNativeStructuredDatePosted: detail.schema.datePosted, closingDate: null, scrapedAt: observedAt,
        companyDomain: 'netomi.com', companyCareerPage: profile.corporateURL, atsPlatform: 'lever',
        sourceNativeRecord: clone(record), sourceNativeJobPosting: clone(detail.schema), sourceOriginalEntitySHA256: hashes,
        sourceAuthoredAIHiringNotice: detail.aiNotice, sourceNativeTextComplete: true, sourceDetailComplete: true,
        sourceNativeDataIdentityQualified: true, sourceEvidenceScope: 'own-native-text-data-only', sourceOwnDetailAPIVisited: false,
        sourceCorporateBindingQualified: false, sourceFormalLegalEntityQualified: false,
        sourceActivationComplete: false, sourceRenderedCriteriaComplete: false, sourceApplicationQualificationComplete: false,
        sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false}
    })
    audit.returnedNativeIndiaTextRecords = jobs.length
    await finishAudit()
    need(jobs.length > 0 || maxJobs === 0, 'No paired native India text; zero inventory unverified')
    Object.defineProperty(jobs, 'sourceAudit', {value: audit})
    attachSourceObservationEvidence(jobs, audit)
    Object.defineProperty(jobs, 'nativeCollectionEvidence', {value: audit, configurable: true})
    return attachInventoryEvidence(jobs, {status: 'coverage-gap', surface: profile.boardURL, firstParty: true,
      listingComplete: false, lifecycleCleanupAllowed: false, reportedTotal: null, indiaFacetCount: null,
      pagesFetched: audit.rawPages.length, verifiedAt: observedAt,
      reason: 'Finite own-native text observations; corporate/legal/rendered/application/whole-company/cleanup held.'})
  } catch (error) {
    caller?.throwIfAborted()
    audit.completedAt = new Date().toISOString(); audit.physicalRequests = audit.rawPages.length; audit.originalEntityBytes = aggregateBytes
    if (error && typeof error === 'object') {
      Object.defineProperty(error, 'nativeCollectionEvidence', {value: audit, configurable: true})
      Object.defineProperty(error, 'recruitmentObservations', {value: audit, configurable: true})
    }
    throw error
  } finally {clearTimeout(sourceTimer)}
}})
export const run = options => createNetomiNativeTextScraper().run(options)
