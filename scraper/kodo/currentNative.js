import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {isDeepStrictEqual, types} from 'node:util'
import {readNativeDocument, activeIframeDeclarations, extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const profile = JSON.parse(readFileSync(new URL('./reviewedNative20261114.json', import.meta.url)))
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const clone = value => structuredClone(value)
const same = isDeepStrictEqual
const failure = message => Object.assign(Error('Kodo native criteria coverage gap: ' + message), {
  softFailure: true, failureKind: 'coverage_gap', sourceScopeComplete: false, lifecycleCleanupAllowed: false,
})
const need = (ok, message) => {if (!ok) throw failure(message)}
const only = (rows, label) => {need(rows.length === 1, 'Missing/ambiguous ' + label); return rows[0]}
const allNodes = node => [node, ...node.children.filter(child => typeof child !== 'string').flatMap(allNodes)]
const json = text => {const parsed = readLiteralModel(text); need(parsed.validJSON, 'Original strict JSON required'); return clone(parsed.value)}
const keys = (value, expected) => value && typeof value === 'object' && !Array.isArray(value)
  && same(Object.keys(value).sort(), [...expected].sort())
const countryLocation = value => typeof value === 'string' && /,\s*India$/.test(value)
const unavailable = text => /\b(?:this|the) (?:position|role|job|vacancy) (?:is|was|has been) (?:now )?(?:closed|filled|expired|unavailable)\b|\bno longer accepting applications\b/i.test(text)
const string = value => typeof value === 'string' && value.length > 0 && value.length <= 10000
const atom = value => value === null || typeof value === 'string'
export const KODO_NATIVE_LIMITS = Object.freeze({maxRequests: 48, sourceTimeoutMs: 90000,
  openingTimeoutMs: 45000, requestTimeoutMs: 15000, maxEntityBytes: 4000000,
  maxAggregateBytes: 24000000, maxPages: 8, maxDetails: 14, maxPublicDetails: 2})
const kindCaps = Object.freeze({corporate: 1048576, board: 1048576, program: 1048576, json: 131072, role: 262144})
const fixedPhaseBytes = 2 * kindCaps.corporate + kindCaps.board + 3 * kindCaps.program + 2 * kindCaps.json
const firstListURL = 'https://api.pyjamahr.com/api/career/jobs/?company_uuid=FC3BF22FD8&page=1&is_careers_page=true'
const detailURL = id => 'https://api.pyjamahr.com/api/career/jobs/' + id + '/?company_uuid=FC3BF22FD8&is_careers_page=false'
const expectedCompany = profile.knownCompletePublicRoleEnvelopes[0].reviewedNonJobModel.props.pageProps.companyDetails
const wholePins = new Map([...profile.currentCorporate, profile.nativeBoard, ...profile.wholeCriticalClients]
  .map(row => [row.requestedURL, {bytes: row.bytes, sha256: row.sha256 ?? row.wholeOriginalSHA256}]))
const roleEnvelopes = new Map(profile.knownCompletePublicRoleEnvelopes.map(row => [row.id, row]))
const reviewedWorksites = new Map(profile.reviewedNativeWorksites.map(row => [row.id,
  {country: row.country, location: row.location, other_locations: row.other_locations}]))
const typedArray = Object.getPrototypeOf(Uint8Array.prototype)
const intrinsic = name => Object.getOwnPropertyDescriptor(typedArray, name).get
const byteLength = intrinsic('byteLength'), byteOffset = intrinsic('byteOffset'), backingBuffer = intrinsic('buffer')
const ignore = operation => {try {Promise.resolve(operation()).catch(() => {})} catch {}}

export const nativeKodoInstant = (value, observation = false) => {
  const match = typeof value === 'string' && /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.(\d{3}|\d{6})(Z|[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00))$/.exec(value)
  need(match && (observation || match[2].length === 6 && match[3] !== 'Z'), 'Native microsecond date/time/offset requires review')
  const calendar = new Date(match[1] + 'T00:00:00.000Z'), instant = Date.parse(value)
  need(Number.isFinite(+calendar) && calendar.toISOString().slice(0, 10) === match[1] && Number.isFinite(instant), 'Invalid native calendar date')
  return BigInt(instant) * 1000n + BigInt(match[2].padEnd(6, '0').slice(3))
}
const document = html => {
  const doc = readNativeDocument(html), root = only(doc.nodes(node => node.tag === 'root'), 'native root')
  return {doc, nodes: allNodes(root)}
}
const ssr = html => {
  const parsed = document(html)
  const carrier = only(parsed.nodes.filter(node => node.tag === 'script' && node.attrs.id === '__NEXT_DATA__'), 'complete native JSON owner')
  need(!carrier.inert && keys(carrier.attrs, ['id', 'type']) && carrier.attrs.type === 'application/json', 'Unreviewed native JSON owner/attributes')
  return {...parsed, carrier, model: json(carrier.raw)}
}
const corporateHandoff = html => {
  const declarations = activeIframeDeclarations(html)
  need(declarations.length === 1 && new URL(declarations[0].href).href === profile.nativeBoard.requestedURL, 'Exact own false-header iframe declaration changed')
  need(document(html).nodes.some(node => node.tag === 'a' && node.attrs.href === 'https://app.kodo.in/login'), 'Literal unvisited corporate native-domain declaration changed')
}
const boardCompany = html => {
  const parsed = ssr(html), {model} = parsed
  need(same(model.props?.pageProps?.companyDetails, expectedCompany)
    && keys(model.props.pageProps, ['isBot', 'companyDetails']) && model.props.pageProps.isBot === false
    && same(model.query, {company: 'Kodo', company_uuid: 'FC3BF22FD8', isHeaderVisible: 'false', is_careers_page: 'true'})
    && model.page === '/careers', 'Whole own company/UUID/website/false-header board context changed')
  for (const client of profile.wholeCriticalClients) need(parsed.nodes.some(node => node.tag === 'script'
    && new URL(node.attrs.src ?? '', 'https://app.pyjamahr.com').href === client.requestedURL), 'Critical current client declaration missing')
  return clone(model)
}
const listingFields = ['id', 'slug', 'title', 'max_experience', 'min_experience', 'country', 'location', 'other_locations', 'department_name', 'published_internally', 'workplace_type', 'product']
const listModel = (value, page) => {
  need(keys(value, ['count', 'next', 'previous', 'results']) && value.count === 14 && Array.isArray(value.results)
    && value.results.length === (page === 1 ? 10 : 4), 'Unknown complete native listing schema/count')
  const second = 'https://api.pyjamahr.com/api/career/jobs/?company_uuid=FC3BF22FD8&is_careers_page=true&page=2'
  const previous = 'https://api.pyjamahr.com/api/career/jobs/?company_uuid=FC3BF22FD8&is_careers_page=true'
  need(value.next === (page === 1 ? second : null) && value.previous === (page === 1 ? null : previous), 'Unknown native pagination route')
  for (const row of value.results) need(keys(row, listingFields) && Number.isSafeInteger(row.id) && row.id > 0
    && string(row.title) && string(row.slug) && row.country === 'India' && countryLocation(row.location)
    && same(row.other_locations, []) && row.published_internally === false && row.workplace_type === 'ON_SITE'
    && row.product === null && atom(row.department_name) && Number.isFinite(row.min_experience)
    && Number.isFinite(row.max_experience) && row.min_experience >= 0 && row.max_experience >= row.min_experience,
  'Native listing country/publication/identity/criteria changed')
  return value
}
const fullDetail = (job, row, observedInstant) => {
  need(keys(job, profile.nativeFullDetailFields), 'Unknown complete35-field native DTO')
  need(job.id === row.id && typeof job.uuid === 'string' && /^[A-F0-9]{10}$/.test(job.uuid) && string(job.title)
    && job.email_domain === 'kodo.in' && job.company_country === 'Premium-Converted-India'
    && job.country === 'India' && countryLocation(job.location) && same(job.other_locations, [])
    && job.published_internally === false && job.remote === false && job.workplace_type === 'ON_SITE', 'Own native role/country/domain/status conflict')
  for (const key of ['title', 'country', 'location', 'other_locations', 'published_internally', 'max_experience', 'min_experience', 'department_name', 'workplace_type']) need(same(job[key], row[key]), 'Listing/detail full qualification conflict: ' + key)
  const reviewedWorksite = reviewedWorksites.get(row.id)
  if (reviewedWorksite) need(same(reviewedWorksite,
    {country: job.country, location: job.location, other_locations: job.other_locations}),
  'Changed reviewed native role-specific worksite/country tuple')
  for (const key of ['skill', 'education', 'seniority']) need(Array.isArray(job[key]) && job[key].length <= 100 && job[key].every(string), 'Unknown native structured criterion ' + key)
  need(same(job.job_screening_questions, []) && job.company_career_page_url === null && job.email_provider === null
    && job.referral_email === 'refer@kodo.pyjamahr.com' && job.is_employee_referral_flow_enabled === false
    && job.is_hr_job === false && typeof job.is_seo_indexable === 'boolean', 'Unknown questions/application/authority carrier')
  need(['FULLTIME', 'INTERN'].includes(job.job_type) && ['MONTHLY', 'ANNUAL'].includes(job.salary_type)
    && job.currency === 'INR' && typeof job.is_salary_visible === 'boolean' && atom(job.industry)
    && atom(job.department_name) && (job.department === null || Number.isSafeInteger(job.department) && job.department > 0), 'Unknown native employment/pay context')
  for (const key of ['min_salary', 'max_salary']) need(job[key] === null || Number.isFinite(job[key]) && job[key] >= 0, 'Invalid native pay criterion')
  need((job.min_salary === null) === (job.max_salary === null) && (job.min_salary === null || job.min_salary <= job.max_salary)
    && (!job.is_salary_visible || job.min_salary !== null), 'Contradictory native pay criterion')
  const created = nativeKodoInstant(job.created_at), expires = nativeKodoInstant(job.valid_through)
  need(created <= observedInstant && expires >= created, 'Native created/expiry chronology conflict')
  need(typeof job.description === 'string' && Buffer.byteLength(job.description) <= 100000
    && !/<!--|<!\[|<\?|<!doctype/i.test(job.description), 'Unknown rich criteria carrier')
  const rich = document(job.description), tags = new Set(['root', 'p', 'br', 'ul', 'li', 'strong', 'u', 'div', 'b'])
  need(rich.nodes.every(node => tags.has(node.tag) && !node.inert && Object.keys(node.attrs).length === 0), 'Unknown native criteria markup/visibility/activation')
  const text = extractActiveDescription(job.description)
  need(text?.length >= 100 && /responsibilit|qualificat|requirement|experience|skill/i.test(text) && !unavailable(text), 'Substantive available native criteria required')
  return {originalNativeDetail: clone(job), criteriaText: text, expired: expires <= observedInstant,
    nativeReviewedWorksiteQualified: Boolean(reviewedWorksite)}
}
const publicCarrier = (raw, row, job) => {
  const envelope = roleEnvelopes.get(row.id)
  need(envelope, 'Unreviewed own public role carrier')
  const prefix = raw.subarray(0, envelope.prefixBytes), suffix = raw.subarray(raw.length - envelope.suffixBytes)
  need(raw.length > envelope.prefixBytes + envelope.suffixBytes && sha(prefix) === envelope.prefixSHA256
    && sha(suffix) === envelope.suffixSHA256, 'Changed complete original public role envelope')
  const slot = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(raw.subarray(envelope.prefixBytes, raw.length - envelope.suffixBytes))
  const parsed = ssr(raw.toString('utf8')), model = json(slot)
  need(parsed.carrier.raw === slot && same(parsed.model, model), 'Relocated/ambiguous complete native JSON data slot')
  const nonJob = clone(model)
  delete nonJob.props?.pageProps?.job
  need(same(nonJob, envelope.reviewedNonJobModel) && same(model.props?.pageProps?.job, job), 'Whole native API/public DTO/company/query mismatch')
  const titles = parsed.doc.nodes(node => (node.attrs.class ?? '').split(/\s+/).includes('c-title')).map(node => parsed.doc.text(node))
  need(titles.includes(row.title), 'Original own public role title conflict')
  const metas = parsed.nodes.filter(node => node.tag === 'meta' && node.attrs.name === 'twitter:description')
  const compact = value => extractActiveDescription(value)?.replace(/\s/g, '')
  need(metas.length === 1 && compact(metas[0].attrs.content) === compact(job.description), 'Full original metadata/native criteria conflict')
  const applies = parsed.doc.nodes(node => node.tag === 'a' && parsed.doc.text(node) === 'Apply')
  const applyUrl = applies.length === 1 ? new URL(applies[0].attrs.href, envelope.currentRoleURL).href : null
  need(applyUrl === envelope.currentRoleURL + '&apply_now=true', 'Original actual Apply declaration conflict')
  return {sourceURL: envelope.currentRoleURL, applyURL: applyUrl, originalSSR: clone(model), originalHTML: raw.toString('utf8')}
}
const completeDescription = job => {
  const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
  const fields = [['Employment Type', job.job_type], ['Workplace Type', job.workplace_type], ['Industry', job.industry], ['Experience Level', job.seniority.join(', ')],
    ['Education', job.education.join(', ')], ['Skills', job.skill.join(', ')], ['Work Experience (years)', job.min_experience + ' - ' + job.max_experience]]
  if (job.is_salary_visible) fields.push(['Compensation', [job.currency, job.min_salary + ' - ' + job.max_salary, job.salary_type].join(' ')])
  return job.description + '\n<dl>' + fields.filter(([, value]) => value != null && String(value).trim()).map(([label, value]) => '<dt>' + label + '</dt><dd>' + escape(value) + '</dd>').join('') + '</dl>'
}

export const createKodoScraper = (defaults = {}) => ({name: 'kodo', async run(passed = {}) {
  const options = {...defaults, ...passed}, caller = options.signal
  caller?.throwIfAborted()
  need(!options.fetchPage && !options.fetchJson && !options.fetchText, 'Full original Response byte transport required')
  const limits = {}
  for (const [key, maximum] of Object.entries(KODO_NATIVE_LIMITS)) {
    const value = options[key] ?? maximum
    need(Number.isSafeInteger(value) && value > 0 && value <= maximum, 'Invalid reduced ' + key)
    limits[key] = value
  }
  need(limits.maxRequests >= 16 && limits.maxAggregateBytes >= 2 * fixedPhaseBytes, 'Opening/closing discovery reservation cannot fit')
  const maxJobs = options.maxJobs === Infinity ? null : options.maxJobs ?? null
  need(maxJobs === null || Number.isSafeInteger(maxJobs) && maxJobs >= 0, 'Invalid maxJobs')
  const onAudit = options.onAudit ?? (() => {}), onRecords = options.onRecords ?? (() => {})
  need(typeof onAudit === 'function' && typeof onRecords === 'function', 'Invalid audit observer')
  const acquire = options.fetchImpl ?? globalThis.fetch
  need(typeof acquire === 'function', 'Native full Response transport unavailable')
  const control = new AbortController(), began = performance.now()
  const timer = setTimeout(() => control.abort(failure('Source deadline exceeded')), limits.sourceTimeoutMs)
  const signal = caller ? AbortSignal.any([caller, control.signal]) : control.signal
  let phase = 'opening', phaseDeadline = began + Math.min(limits.openingTimeoutMs, Math.floor(limits.sourceTimeoutMs / 2)), aggregate = 0
  const audit = {source: 'kodo', startedAt: new Date().toISOString(), recordKind: 'vacancy-rows', observedRecordCount: 0, observedVacancyCount: 0,
    sourceScopeComplete: false, lifecycleCleanupAllowed: false, formalLegalEmployer: null, sourceActivationComplete: false,
    sourceRenderedCriteriaComplete: false, sourceApplicationQualificationComplete: false, sourceEvidenceScope: 'native-role-criteria-as-data-only',
    limits: {...limits, pacingMs: 500, kindCaps}, rawPages: [], observations: [], exclusions: [], issues: []}
  const check = () => {caller?.throwIfAborted(); signal.throwIfAborted(); need(performance.now() < phaseDeadline, phase === 'opening' ? 'Opening deadline/closing time reservation exceeded' : 'Source deadline exceeded')}
  const wait = (operation, scoped = signal, dispose) => new Promise((resolve, reject) => {
    let done = false, reason
    const detach = () => scoped.removeEventListener('abort', abort)
    const rejectOnce = error => {if (!done) {done = true; reason = error; detach(); reject(error)}}
    const abort = () => rejectOnce(caller?.aborted ? caller.reason : scoped.reason)
    scoped.addEventListener('abort', abort, {once: true})
    try {check(); scoped.throwIfAborted()} catch (error) {rejectOnce(error); return}
    Promise.resolve().then(() => {check(); scoped.throwIfAborted(); return operation()}).then(value => {
      if (done) {if (dispose) ignore(() => dispose(value, reason)); return}
      try {check(); scoped.throwIfAborted()} catch (error) {rejectOnce(error); if (dispose) ignore(() => dispose(value, error)); return}
      done = true; detach(); resolve(value)
    }, error => {try {check(); scoped.throwIfAborted()} catch (original) {error = original} rejectOnce(error)})
  })
  const lastStart = new Map(), allowed = new Set([...wholePins.keys(), firstListURL])
  let closingReserveBytes = fixedPhaseBytes
  const read = async (url, kind) => {
    check(); need(allowed.has(url) && audit.rawPages.length < limits.maxRequests, 'Unbound URL or physical read ceiling')
    const origin = new URL(url).origin
    let pause = 500 - (performance.now() - (lastStart.get(origin) ?? -Infinity))
    while (pause > 0) {
      await wait(() => new Promise(resolve => {
      const abort = () => clearTimeout(queued)
      const queued = setTimeout(() => {signal.removeEventListener('abort', abort); resolve()}, Math.ceil(pause))
      signal.addEventListener('abort', abort, {once: true})
      }))
      check()
      pause = 500 - (performance.now() - (lastStart.get(origin) ?? -Infinity))
    }
    check()
    const local = new AbortController(), deadline = setTimeout(() => local.abort(failure('Native request deadline exceeded')),
      Math.max(1, Math.min(limits.requestTimeoutMs, Math.floor(phaseDeadline - performance.now()))))
    const requestSignal = AbortSignal.any([signal, local.signal])
    const receipt = {index: audit.rawPages.length, phase, method: 'GET', url, kind, startedAt: new Date().toISOString(), bytes: 0, entityComplete: false}
    audit.rawPages.push(receipt); lastStart.set(origin, performance.now())
    let response, reader, completed = false
    const cancel = reason => ignore(() => {
      if (reader) {ignore(() => reader.cancel(reason)); ignore(() => reader.releaseLock())} else if (response?.body) ignore(() => response.body.cancel(reason))
    })
    try {
      response = await wait(() => acquire(url, {method: 'GET', redirect: 'manual', credentials: 'omit', signal: requestSignal,
        headers: {Accept: kind === 'json' ? 'application/json' : 'text/html', 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify careers inventory check)'}}), requestSignal, (late, reason) => late.body?.cancel(reason))
      receipt.status = response.status; receipt.responseURL = response.url; receipt.redirected = response.redirected
      if (response.status !== 200) throw Object.assign(failure('Native HTTP ' + response.status), {status: response.status,
        failureKind: [401, 403, 429, 451].includes(response.status) ? 'blocked_or_access_denied' : 'coverage_gap'})
      need(response.url === url && response.redirected === false, 'Changed/prefollowed original response authority')
      receipt.contentType = response.headers.get('content-type') ?? ''
      const mime = kind === 'json' ? 'application\\/json' : kind === 'program' ? '(?:application|text)\\/javascript' : 'text\\/html'
      need(new RegExp('^' + mime + '(?:\\s*;\\s*charset\\s*=\\s*(?:utf-8|"utf-8"))?$', 'i').test(receipt.contentType), 'Unreviewed original MIME/UTF8 charset')
      need(response.body && typeof response.body.getReader === 'function', 'Original byte stream unavailable')
      reader = await wait(() => response.body.getReader(), requestSignal, (late, reason) => {ignore(() => late.cancel(reason)); ignore(() => late.releaseLock())})
      const chunks = []
      for (;;) {
        const {done, value} = await wait(() => reader.read(), requestSignal)
        if (done) break
        need(types.isUint8Array(value), 'Original Uint8Array chunks required')
        const count = byteLength.call(value)
        receipt.bytes += count; aggregate += count
        need(receipt.bytes <= Math.min(limits.maxEntityBytes, kindCaps[kind]) && aggregate <= limits.maxAggregateBytes
          && (phase !== 'opening' || aggregate + closingReserveBytes <= limits.maxAggregateBytes), 'Streaming kind/aggregate/closing byte reservation exceeded')
        chunks.push(Buffer.from(new Uint8Array(backingBuffer.call(value), byteOffset.call(value), count)))
      }
      const raw = Buffer.concat(chunks)
      receipt.entityComplete = true; receipt.rawEntitySHA256 = sha(raw); receipt.bodyBase64 = raw.toString('base64')
      need(!(raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf), 'Unreviewed original BOM')
      let text
      try {text = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(raw)} catch {throw failure('Invalid original UTF8 bytes')}
      need(Buffer.from(text).equals(raw), 'Original UTF8 byte roundtrip changed')
      const pin = wholePins.get(url)
      if (pin) need(raw.length === pin.bytes && receipt.rawEntitySHA256 === pin.sha256, 'Changed whole original corporate/board/client bytes')
      completed = true
      return {raw, text, receipt}
    } catch (error) {cancel(error); caller?.throwIfAborted(); receipt.error = error?.message ?? String(error); throw error}
    finally {clearTimeout(deadline); if (completed && reader) ignore(() => reader.releaseLock()); receipt.completedAt = new Date().toISOString()}
  }
  try {
    let observedAt
    try {observedAt = typeof options.now === 'function' ? options.now() : options.now ?? new Date().toISOString()} finally {check()}
    const observedInstant = nativeKodoInstant(observedAt, true)
    const discovery = async () => {
      await read(profile.currentCorporate[0].requestedURL, 'corporate')
      const careers = await read(profile.currentCorporate[1].requestedURL, 'corporate'); corporateHandoff(careers.text)
      const board = await read(profile.nativeBoard.requestedURL, 'board'), company = boardCompany(board.text)
      for (const client of profile.wholeCriticalClients) await read(client.requestedURL, 'program')
      const first = listModel(json((await read(firstListURL, 'json')).text), 1)
      need(limits.maxPages >= 2, 'Complete current listing pages do not fit reduced caller budget')
      allowed.add(first.next)
      const second = listModel(json((await read(first.next, 'json')).text), 2)
      const rows = [...first.results, ...second.results]
      need(rows.length === 14 && new Set(rows.map(row => row.id)).size === 14, 'Incomplete/duplicate current native inventory')
      return {company, pages: [first, second], rows}
    }
    const opening = await discovery()
    audit.opening = clone(opening); audit.observedRecordCount = opening.rows.length; audit.observedVacancyCount = opening.rows.length
    audit.observations = opening.rows.map(row => ({id: row.id, sourceNativeListingRecord: clone(row), qualified: false}))
    let nativeCount = Math.min(opening.rows.length, limits.maxDetails), htmlCount
    for (; nativeCount >= 0; nativeCount--) {
      htmlCount = Math.min(nativeCount, limits.maxPublicDetails, maxJobs ?? limits.maxPublicDetails)
      if (16 + 2 * nativeCount + 2 * htmlCount <= limits.maxRequests
        && 2 * (fixedPhaseBytes + nativeCount * kindCaps.json + htmlCount * kindCaps.role) <= limits.maxAggregateBytes) break
    }
    need(nativeCount >= 0, 'Complete selected closing reservation cannot fit')
    closingReserveBytes = fixedPhaseBytes + nativeCount * kindCaps.json + htmlCount * kindCaps.role
    audit.closingReservation = {physicalReads: 8 + nativeCount + htmlCount, kindCeilingBytes: closingReserveBytes}
    const selected = opening.rows.slice(0, nativeCount), details = new Map(), publicPages = new Map()
    for (const row of selected) {
      const url = detailURL(row.id); allowed.add(url)
      const response = await read(url, 'json'), detail = fullDetail(json(response.text), row, observedInstant)
      details.set(row.id, detail)
      const observation = audit.observations.find(item => item.id === row.id)
      observation.opening = {...clone(detail), rawEntitySHA256: response.receipt.rawEntitySHA256}
      if (detail.expired) {audit.exclusions.push({id: row.id, reason: 'explicit-native-valid-through-expired', nativeValidThrough: detail.originalNativeDetail.valid_through}); continue}
      const envelope = roleEnvelopes.get(row.id)
      if (!detail.nativeReviewedWorksiteQualified || publicPages.size >= htmlCount || !envelope) {audit.issues.push({id: row.id, reason: 'Unqualified or budget-held public carrier'}); continue}
      allowed.add(envelope.currentRoleURL)
      const html = await read(envelope.currentRoleURL, 'role'), carrier = publicCarrier(html.raw, row, detail.originalNativeDetail)
      publicPages.set(row.id, carrier); observation.publicOpening = {...clone(carrier), rawEntitySHA256: html.receipt.rawEntitySHA256}
    }
    check(); phase = 'closing'; phaseDeadline = began + limits.sourceTimeoutMs
    const closing = await discovery()
    audit.closing = clone(closing)
    need(same(opening, closing), 'Closing whole inventory/count/order/status/company changed')
    for (const row of selected) {
      const response = await read(detailURL(row.id), 'json'), detail = fullDetail(json(response.text), row, observedInstant)
      need(same(detail, details.get(row.id)), 'Closing complete35-field native criterion/date/identity changed')
      const observation = audit.observations.find(item => item.id === row.id)
      observation.closing = {...clone(detail), rawEntitySHA256: response.receipt.rawEntitySHA256}
      if (!publicPages.has(row.id)) continue
      const envelope = roleEnvelopes.get(row.id), html = await read(envelope.currentRoleURL, 'role')
      const carrier = publicCarrier(html.raw, row, detail.originalNativeDetail)
      need(same(carrier, publicPages.get(row.id)), 'Closing complete public data/carrier changed')
      observation.publicClosing = {...clone(carrier), rawEntitySHA256: html.receipt.rawEntitySHA256}; observation.qualified = true
    }
    check(); audit.nativeInventoryPairComplete = true; audit.pairedNativeDetailCount = selected.length
    audit.pairedPublicRoleCount = publicPages.size; audit.unhydratedNativeRecordCount = opening.rows.length - selected.length
    const jobs = [...publicPages].map(([id, carrier]) => {
      const job = details.get(id).originalNativeDetail, description = completeDescription(job)
      return {source: 'kodo', company: 'Kodo', companyName: 'Kodo', title: job.title, jobId: String(id), requisitionId: String(id),
        sourceUrl: carrier.sourceURL, link: carrier.sourceURL, applyUrl: carrier.applyURL,
        country: job.country, countryCode: 'IN', location: job.location, city: null, state: null,
        companyDomain: 'kodo.com', companyCareerPage: 'https://www.kodo.com/careers', atsPlatform: 'pyjamahr',
        department: job.department_name, employmentType: job.job_type === 'INTERN' ? 'Internship' : 'Full-time', remoteStatus: 'On-site',
        requiredSkills: clone(job.skill), minimumQualification: job.education.join('; ') || null,
        experienceRequired: job.min_experience + ' - ' + job.max_experience + ' years',
        jobDescription: description, sourceDescription: description, postingDate: null, postedAt: null,
        sourceNativeCreatedAt: job.created_at, closingDate: job.valid_through, sourceNativeValidThrough: job.valid_through, scrapedAt: observedAt,
        sourceNativeRecord: clone(job), sourceNativeSSR: clone(carrier.originalSSR), sourceOriginalHTML: carrier.originalHTML,
        sourceNativeCompany: clone(expectedCompany), sourceNativeAPIURL: detailURL(id), sourceNativeQuestions: clone(job.job_screening_questions),
        sourceDetailComplete: true, sourceNativeTextComplete: true, sourceEvidenceScope: 'native-role-criteria-as-data-only',
        sourceFormalLegalEntityQualified: false, sourceActivationComplete: false, sourceRenderedCriteriaComplete: false,
        sourceApplicationQualificationComplete: false, sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false}
    })
    audit.returnedIndiaJobs = jobs.length; audit.physicalRequests = audit.rawPages.length; audit.originalEntityBytes = aggregate; audit.completedAt = new Date().toISOString()
    await wait(() => onAudit(clone(audit))); await wait(() => onRecords(clone(audit.observations))); check()
    need(jobs.length > 0 || maxJobs === 0, 'No paired unexpired native role; zero inventory remains unverified')
    attachSourceObservationEvidence(jobs, audit)
    Object.defineProperties(jobs, {sourceAudit: {value: audit}, nativeCollectionEvidence: {value: audit, configurable: true}})
    return attachInventoryEvidence(jobs, {status: 'coverage-gap', surface: profile.nativeBoard.requestedURL, firstParty: true,
      listingComplete: false, lifecycleCleanupAllowed: false, reportedTotal: null, indiaFacetCount: null, pagesFetched: audit.rawPages.length,
      verifiedAt: observedAt, reason: 'Finite native criteria-as-data; complete company/rendered/application/cleanup scope held.'})
  } catch (error) {
    caller?.throwIfAborted(); audit.physicalRequests = audit.rawPages.length; audit.originalEntityBytes = aggregate; audit.completedAt = new Date().toISOString()
    if (error && typeof error === 'object') for (const name of ['nativeCollectionEvidence', 'recruitmentObservations']) Object.defineProperty(error, name, {value: audit, configurable: true})
    throw error
  } finally {clearTimeout(timer)}
}})
export const run = options => createKodoScraper().run(options)
