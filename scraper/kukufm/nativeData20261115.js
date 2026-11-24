import {createCurrentKukuFMScraper} from './currentNative20261121.js'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {isDeepStrictEqual, types} from 'node:util'
import {readNativeDocument, extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const profile = JSON.parse(readFileSync(new URL('./reviewedNativeData20261115.json', import.meta.url)))
const currentInventory = JSON.parse(readFileSync(new URL('./reviewedNativeInventory20261116.json', import.meta.url)))
// Each cohort retains every ordered page, count, row field and pagination link.
// The November16 cohort adds one advertised, unhydrated native record; it does
// not extend the six reviewed criteria-data roles or qualify any held scope.
const inventoryCohorts = [
  {listingPages: profile.listingPages, expectedNativeRecordCount: 76},
  currentInventory,
]
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const clone = value => structuredClone(value)
const same = isDeepStrictEqual
const failure = message => Object.assign(Error('Kuku FM native data coverage gap: ' + message), {
  softFailure: true, failureKind: 'coverage_gap', sourceScopeComplete: false, lifecycleCleanupAllowed: false,
})
const need = (condition, message) => {if (!condition) throw failure(message)}
const ignore = action => {try {Promise.resolve(action()).catch(() => {})} catch {}}
const json = text => {
  let parsed
  try {parsed = readLiteralModel(text)} catch {throw failure('Original strict complete JSON required')}
  need(parsed.validJSON, 'Original strict complete JSON required')
  return clone(parsed.value)
}
const html = text => {
  const doc = readNativeDocument(text)
  const carriers = doc.nodes(node => node.tag === 'script' && node.attrs.id === '__NEXT_DATA__')
  need(carriers.length === 1 && !carriers[0].inert && carriers[0].attrs.type === 'application/json'
    && same(Object.keys(carriers[0].attrs).sort(), ['id', 'type']), 'Complete native JSON owner/attributes require review')
  return {doc, carrier: carriers[0], model: json(carriers[0].raw)}
}
export const KUKU_NATIVE_LIMITS = Object.freeze({maxRequests: 48, maxPages: 8, maxDetails: 6,
  sourceTimeoutMs: 90000, openingTimeoutMs: 45000, requestTimeoutMs: 15000,
  maxEntityBytes: 4000000, maxAggregateBytes: 24000000})
const kindCaps = Object.freeze({board: 1048576, program: 1048576, json: 131072, role: 262144})
const closingByteReserve = kindCaps.board + 3 * kindCaps.program + 14 * kindCaps.json + 6 * kindCaps.role
const wholePins = new Map([profile.nativeBoard, ...profile.wholeCriticalClients].map(pin => [pin.requestedURL, pin]))
const allowed = new Set([...wholePins.keys(), ...profile.listingPages.map(page => page.requestedURL),
  ...profile.reviewedSelectedRoles.flatMap(role => [role.nativeAPIURL, role.nativeLandingURL])])
const typedArray = Object.getPrototypeOf(Uint8Array.prototype)
const intrinsic = key => Object.getOwnPropertyDescriptor(typedArray, key).get
const intrinsicLength = intrinsic('byteLength'), intrinsicOffset = intrinsic('byteOffset'), intrinsicBuffer = intrinsic('buffer')
const unavailable = text => /\b(?:this|the) (?:position|role|job|vacancy) (?:is|was|has been) (?:now )?(?:closed|filled|expired|unavailable)\b|\bno longer accepting applications\b/i.test(text)

// Native created_at is retained only as creation, never publication. Validate
// every calendar component and retain native microseconds for exact expiry.
export const nativeKukuInstant = (value, observation = false) => {
  const match = typeof value === 'string' && /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.(\d{3}|\d{6})(Z|[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00))$/.exec(value)
  need(match && (observation || match[2].length === 6 && match[3] !== 'Z'), 'Native microsecond date/time/offset requires review')
  const calendar = new Date(match[1] + 'T00:00:00.000Z'), instant = Date.parse(value)
  need(Number.isFinite(+calendar) && calendar.toISOString().slice(0, 10) === match[1] && Number.isFinite(instant), 'Native calendar date invalid')
  return BigInt(instant) * 1000n + BigInt(match[2].padEnd(6, '0').slice(3))
}
const fullDetail = (job, role, rows, observedInstant) => {
  const created = nativeKukuInstant(job?.created_at), expires = nativeKukuInstant(job?.valid_through)
  need(created <= observedInstant && expires >= created, 'Native chronology conflict')
  need(same(job, role.reviewedComplete35FieldNativeDTO), 'Complete reviewed35-field native criteria/question/date/identity model changed')
  need(same({country: job.country, location: job.location, other_locations: job.other_locations}, role.nativeWorksite)
    && job.country === 'India', 'Exact role-owned native worksite/country tuple changed')
  const row = rows.find(item => item.id === role.id)
  need(row && ['title', 'country', 'location', 'other_locations', 'published_internally', 'max_experience',
    'min_experience', 'department_name', 'workplace_type'].every(key => same(row[key], job[key])), 'Complete native listing/detail qualification conflict')
  const criteriaText = extractActiveDescription(job.description)
  need(criteriaText?.length >= 100 && /responsibilit|qualificat|requirement|experience|skill/i.test(criteriaText)
    && !unavailable(criteriaText), 'Substantive available native role criteria required')
  return {originalNativeDetail: clone(job), criteriaText, expired: expires <= observedInstant}
}
const publicCarrier = (raw, role, job) => {
  const contract = role.carrier
  need(raw.length > contract.prefixBytes + contract.suffixBytes
    && sha(raw.subarray(0, contract.prefixBytes)) === contract.prefixSHA256
    && sha(raw.subarray(raw.length - contract.suffixBytes)) === contract.suffixSHA256,
  'Complete original public carrier envelope changed')
  const slot = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true})
    .decode(raw.subarray(contract.prefixBytes, raw.length - contract.suffixBytes))
  const parsed = html(raw.toString('utf8')), model = json(slot)
  need(parsed.carrier.raw === slot && same(model, parsed.model), 'Native JSON owner/data slot relocated or ambiguous')
  const nonJob = clone(model)
  delete nonJob.props?.pageProps?.job
  need(same(nonJob, contract.reviewedNonJobModel) && same(model.props?.pageProps?.job, job),
    'Complete native API/SSR/company/query data conflict')
  return {sourceURL: role.nativeLandingURL, originalSSR: model, originalHTML: raw.toString('utf8')}
}
const escapeHTML = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const completeDescription = job => {
  const structured = Object.fromEntries(['job_type', 'country', 'location', 'other_locations', 'department', 'department_name',
    'remote', 'workplace_type', 'industry', 'min_experience', 'max_experience', 'skill', 'education', 'seniority',
    'salary_type', 'currency', 'is_salary_visible', 'min_salary', 'max_salary'].map(key => [key, clone(job[key])]))
  // Preserve the original rich HTML as the prefix. The exact source question
  // models include yes_no_option/Yes/No/choices:[]; no answers are invented.
  return job.description + '\n<h3>Native structured role criteria</h3><pre>' + escapeHTML(JSON.stringify(structured, null, 2))
    + '</pre>\n<h3>Native screening questions</h3><pre>' + escapeHTML(JSON.stringify(job.job_screening_questions, null, 2)) + '</pre>'
}
const limitsFor = options => {
  const limits = {}
  for (const [name, maximum] of Object.entries(KUKU_NATIVE_LIMITS)) {
    const value = options[name] ?? maximum
    need(Number.isSafeInteger(value) && value > 0 && value <= maximum, 'Invalid ' + name)
    limits[name] = value
  }
  // Existing public-reader callers use these byte/deadline aliases. Every
  // supplied alias can only reduce the corresponding source ceiling.
  for (const [name, target] of [['timeoutMs', 'requestTimeoutMs'], ['collectionTimeoutMs', 'sourceTimeoutMs'],
    ['maxResponseBytes', 'maxEntityBytes'], ['maxBodyBytes', 'maxEntityBytes'], ['responseBytes', 'maxEntityBytes'],
    ['maxTotalBytes', 'maxAggregateBytes'], ['maxSourceBytes', 'maxAggregateBytes'], ['aggregateBytes', 'maxAggregateBytes']]) {
    if (options[name] === undefined) continue
    need(Number.isSafeInteger(options[name]) && options[name] > 0 && options[name] <= KUKU_NATIVE_LIMITS[target], 'Invalid ' + name)
    limits[target] = Math.min(limits[target], options[name])
  }
  for (const name of ['entityTimeoutMs', 'callbackTimeoutMs']) {
    if (options[name] === undefined) continue
    const maximum = name === 'entityTimeoutMs' ? limits.requestTimeoutMs : limits.sourceTimeoutMs
    need(Number.isSafeInteger(options[name]) && options[name] > 0 && options[name] <= maximum, 'Invalid ' + name)
    limits[name] = options[name]
  }
  need(limits.maxRequests === 48 && limits.maxPages === 8 && limits.maxDetails === 6, 'Complete48-read/eight-page/six-role closure cannot fit reduced caller budget')
  need(options.maxJobs === undefined || options.maxJobs === Infinity || Number.isSafeInteger(options.maxJobs)
    && options.maxJobs >= 6, 'Invalid or incomplete selected maxJobs budget')
  return limits
}

// Explicitly historical Nov15/16 fixtures retain the former finite reader.
export const createHistoricalKukuFMScraper = () => ({async run(options = {}) {
  need(options && typeof options === 'object' && !Array.isArray(options), 'Invalid source options')
  const caller = options.signal
  need(caller === undefined || caller instanceof AbortSignal, 'Invalid caller signal')
  caller?.throwIfAborted()
  const limits = limitsFor(options)
  for (const key of ['fetchPage', 'fetchText', 'fetchJson', 'readPage', 'readJson', 'probeUrl']) need(options[key] === undefined, 'Full original Response transport required; body-only callback rejected')
  const acquire = options.fetchImpl ?? globalThis.fetch
  need(typeof acquire === 'function', 'Invalid original Response transport')
  const onAudit = options.onAudit ?? (() => {}), onRecords = options.onRecords ?? (() => {})
  need(typeof onAudit === 'function' && typeof onRecords === 'function', 'Invalid native observer')
  const began = performance.now(), sourceDeadline = began + limits.sourceTimeoutMs
  const control = new AbortController(), signal = caller ? AbortSignal.any([caller, control.signal]) : control.signal
  let phase = 'opening', phaseDeadline = began + Math.min(limits.openingTimeoutMs, Math.floor(limits.sourceTimeoutMs / 2))
  let aggregate = 0
  const audit = {source: 'kukufm', startedAt: new Date().toISOString(), recordKind: 'vacancy-rows',
    observedRecordCount: 0, observedVacancyCount: 0, companyGlobalTotal: null, companyIndiaTotal: null,
    sourceScopeComplete: false, lifecycleCleanupAllowed: false, formalLegalEmployer: null,
    sourceCorporateBindingQualified: false, sourceFormalLegalEntityQualified: false,
    sourceActivationComplete: false, sourceRenderedCriteriaComplete: false, sourceApplicationQualificationComplete: false,
    sourceEvidenceScope: 'native-role-criteria-as-data-only', sourceNativeCompany: clone(profile.reviewedNativeCompany),
    historicalCorporateContext: 'https://kukuapp.in/careers/open-roles/', currentCorporateRead: false,
    limits: {...limits, pacingMs: 500, kindCaps}, closingReservation: {physicalReads: 24, kindCeilingBytes: closingByteReserve,
      timeMs: Math.ceil(limits.sourceTimeoutMs / 2)}, rawPages: [], observations: [], exclusions: [], issues: []}
  const check = () => {
    caller?.throwIfAborted(); signal.throwIfAborted()
    need(performance.now() < phaseDeadline, phase === 'opening' ? 'Opening deadline/closing time reservation exceeded' : 'Source deadline exceeded')
  }
  // Timer callbacks are notifications; recheck monotonic time even if a host
  // timer fires early. Synchronous callbacks also face check() on return.
  const alarm = (controller, deadline, message) => {
    let timer
    const tick = () => {
      const remaining = deadline - performance.now()
      if (remaining <= 0) controller.abort(failure(message))
      else timer = setTimeout(tick, Math.max(1, Math.ceil(remaining)))
    }
    tick()
    return () => clearTimeout(timer)
  }
  const stopSource = alarm(control, sourceDeadline, 'Source deadline exceeded')
  const wait = (operation, scoped = signal, dispose, deadline = phaseDeadline, message = 'Source deadline exceeded') => new Promise((resolve, reject) => {
    let done = false, reason
    const detach = () => scoped.removeEventListener('abort', abort)
    const rejectOnce = error => {if (!done) {done = true; reason = error; detach(); reject(error)}}
    const abort = () => rejectOnce(caller?.aborted ? caller.reason : scoped.reason)
    const guard = () => {check(); scoped.throwIfAborted(); need(performance.now() < deadline, message)}
    scoped.addEventListener('abort', abort, {once: true})
    try {guard()} catch (error) {rejectOnce(error); return}
    Promise.resolve().then(() => {guard(); return operation()}).then(value => {
      if (done) {if (dispose) ignore(() => dispose(value, reason)); return}
      try {guard()} catch (error) {rejectOnce(error); if (dispose) ignore(() => dispose(value, error)); return}
      done = true; detach(); resolve(value)
    }, error => {try {guard()} catch (original) {error = original} rejectOnce(error)})
  })
  const lastStart = new Map()
  const read = async (url, kind) => {
    check()
    need(allowed.has(url) && audit.rawPages.length < limits.maxRequests, 'Unbound native URL or physical read ceiling')
    const origin = new URL(url).origin
    let remaining = 500 - (performance.now() - (lastStart.get(origin) ?? -Infinity))
    while (remaining > 0) {
      await wait(() => new Promise(resolve => {
        const abort = () => clearTimeout(timer)
        const timer = setTimeout(() => {signal.removeEventListener('abort', abort); resolve()}, Math.max(1, Math.ceil(remaining)))
        signal.addEventListener('abort', abort, {once: true})
      }))
      check(); remaining = 500 - (performance.now() - (lastStart.get(origin) ?? -Infinity))
    }
    check()
    const local = new AbortController(), requestDeadline = Math.min(phaseDeadline, performance.now() + limits.requestTimeoutMs)
    const requestSignal = AbortSignal.any([signal, local.signal])
    const stopRequest = alarm(local, requestDeadline, 'Native request deadline exceeded')
    let stopEntity = () => {}, receipt, response, body, reader, completed = false, cancelled = false
    const cancel = reason => {
      if (cancelled) return
      cancelled = true
      if (reader) {ignore(() => reader.cancel(reason)); ignore(() => reader.releaseLock())}
      else if (body) ignore(() => body.cancel(reason))
    }
    try {
      response = await wait(() => {
        check(); requestSignal.throwIfAborted()
        const start = performance.now()
        receipt = {index: audit.rawPages.length, phase, method: 'GET', url, requestedURL: url, kind,
          startedAt: new Date().toISOString(), monotonicStartMs: start - began, bytes: 0, entityComplete: false}
        audit.rawPages.push(receipt); lastStart.set(origin, start)
        return acquire(url, {method: 'GET', redirect: 'manual', credentials: 'omit', signal: requestSignal,
          headers: {Accept: kind === 'json' ? 'application/json' : kind === 'program' ? 'application/javascript' : 'text/html',
            'User-Agent': 'Mozilla/5.0 (compatible; Jobverify careers inventory check)'}})
      }, requestSignal, (late, reason) => late?.body?.cancel(reason), requestDeadline, 'Native request deadline exceeded')
      need(response instanceof Response, 'Full original Response and byte stream required')
      body = response.body
      receipt.status = response.status; receipt.responseURL = response.url; receipt.redirected = response.redirected
      if (response.status !== 200) throw Object.assign(failure('Native HTTP ' + response.status), {status: response.status,
        failureKind: [401, 403, 429, 451].includes(response.status) ? 'blocked_or_access_denied' : 'coverage_gap'})
      need(response.url === url && response.redirected === false, 'Changed/prefollowed original response authority')
      receipt.contentType = response.headers.get('content-type') ?? ''
      const mime = kind === 'json' ? 'application\\/json' : kind === 'program' ? '(?:application|text)\\/javascript' : 'text\\/html'
      need(new RegExp('^' + mime + '(?:\\s*;\\s*charset\\s*=\\s*(?:utf-8|"utf-8"))?$', 'i').test(receipt.contentType), 'Original MIME/UTF8 charset requires review')
      need(body && typeof body.getReader === 'function', 'Original byte stream unavailable')
      const entityDeadline = Math.min(requestDeadline, performance.now() + (limits.entityTimeoutMs ?? limits.requestTimeoutMs))
      stopEntity = alarm(local, entityDeadline, 'Native entity deadline exceeded')
      reader = await wait(() => body.getReader(), requestSignal, (late, reason) => {ignore(() => late.cancel(reason)); ignore(() => late.releaseLock())}, entityDeadline, 'Native entity deadline exceeded')
      const chunks = []
      for (;;) {
        const chunk = await wait(() => reader.read(), requestSignal, undefined, entityDeadline, 'Native entity deadline exceeded')
        need(chunk && typeof chunk === 'object' && typeof chunk.done === 'boolean', 'Invalid original stream result')
        if (chunk.done) {need(chunk.value === undefined, 'Invalid original completed stream value'); break}
        need(types.isUint8Array(chunk.value), 'Original intrinsic Uint8Array chunks required')
        const count = intrinsicLength.call(chunk.value)
        receipt.bytes += count; aggregate += count
        need(receipt.bytes <= Math.min(limits.maxEntityBytes, kindCaps[kind]) && aggregate <= limits.maxAggregateBytes
          && (phase !== 'opening' || aggregate + closingByteReserve <= limits.maxAggregateBytes),
        'Streaming kind/entity/aggregate/closing byte reservation exceeded')
        chunks.push(Buffer.from(new Uint8Array(intrinsicBuffer.call(chunk.value), intrinsicOffset.call(chunk.value), count)))
      }
      const raw = Buffer.concat(chunks)
      receipt.entityComplete = true; receipt.rawEntitySHA256 = sha(raw); receipt.bodyBase64 = raw.toString('base64')
      need(!(raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf), 'Original BOM requires review')
      let text
      try {text = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(raw)} catch {throw failure('Invalid original UTF8 bytes')}
      need(Buffer.from(text).equals(raw), 'Original UTF8 byte roundtrip conflict')
      const pin = wholePins.get(url)
      if (pin) need(raw.length === pin.bytes && receipt.rawEntitySHA256 === pin.rawEntitySHA256, 'Whole original board/program bytes changed')
      completed = true
      return {raw, text, receipt}
    } catch (error) {
      cancel(error); caller?.throwIfAborted()
      if (receipt) receipt.error = error?.message ?? String(error)
      throw error
    } finally {
      stopEntity(); stopRequest()
      if (completed && reader) ignore(() => reader.releaseLock())
      if (receipt) receipt.completedAt = new Date().toISOString()
    }
  }
  const observe = async (callback, value) => {
    const local = new AbortController(), scoped = AbortSignal.any([signal, local.signal])
    const deadline = Math.min(sourceDeadline, performance.now() + (limits.callbackTimeoutMs ?? limits.sourceTimeoutMs))
    const stop = alarm(local, deadline, 'Native observer deadline exceeded')
    try {await wait(() => callback(clone(value)), scoped, undefined, deadline, 'Native observer deadline exceeded')} finally {stop()}
  }
  try {
    let observedAt
    try {observedAt = typeof options.now === 'function' ? options.now() : options.now ?? new Date().toISOString()} finally {check()}
    if (observedAt instanceof Date) observedAt = observedAt.toISOString()
    const observedInstant = nativeKukuInstant(observedAt, true)
    const discovery = async () => {
      const board = await read(profile.nativeBoard.requestedURL, 'board'), boardModel = html(board.text).model
      need(same(boardModel, profile.reviewedCompleteBoardModel), 'Complete own native account/UUID/board context changed')
      for (const client of profile.wholeCriticalClients) await read(client.requestedURL, 'program')
      const firstURL = profile.listingPages[0].requestedURL
      const firstValue = json((await read(firstURL, 'json')).text)
      const matching = inventoryCohorts.filter(cohort => same(firstValue, cohort.listingPages[0].reviewedCompleteNativePage))
      need(matching.length === 1, 'Complete ordered native page/count/row/pagination model changed')
      const cohort = matching[0], pages = [firstValue]
      let next = firstValue.next
      for (const page of cohort.listingPages.slice(1)) {
        need(next === page.requestedURL, 'Complete ordered native page route changed')
        const value = json((await read(next, 'json')).text)
        need(same(value, page.reviewedCompleteNativePage), 'Complete ordered native page/count/row/pagination model changed')
        pages.push(value); next = value.next
      }
      const rows = pages.flatMap(page => page.results)
      need(next === null && rows.length === cohort.expectedNativeRecordCount
        && new Set(rows.map(row => row.id)).size === cohort.expectedNativeRecordCount, 'Incomplete/duplicate current native inventory')
      return {boardModel, pages, rows}
    }
    const opening = await discovery()
    audit.opening = clone(opening); audit.observedRecordCount = opening.rows.length; audit.observedVacancyCount = opening.rows.length
    audit.observations = opening.rows.map(row => ({id: row.id, sourceNativeListingRecord: clone(row), qualified: false}))
    const openingDetails = new Map(), openingCarriers = new Map()
    for (const role of profile.reviewedSelectedRoles) {
      const response = await read(role.nativeAPIURL, 'json'), detail = fullDetail(json(response.text), role, opening.rows, observedInstant)
      const publicResponse = await read(role.nativeLandingURL, 'role'), carrier = publicCarrier(publicResponse.raw, role, detail.originalNativeDetail)
      openingDetails.set(role.id, detail); openingCarriers.set(role.id, carrier)
      const observation = audit.observations.find(row => row.id === role.id)
      observation.opening = {...clone(detail), rawEntitySHA256: response.receipt.rawEntitySHA256}
      observation.publicOpening = {...clone(carrier), rawEntitySHA256: publicResponse.receipt.rawEntitySHA256}
    }
    check(); need(audit.rawPages.length === 24, 'Complete opening read schedule changed')
    phase = 'closing'; phaseDeadline = sourceDeadline
    const closing = await discovery()
    need(same(opening, closing), 'Closing complete native board/inventory/order changed')
    audit.closing = clone(closing)
    for (const role of profile.reviewedSelectedRoles) {
      const response = await read(role.nativeAPIURL, 'json'), detail = fullDetail(json(response.text), role, closing.rows, observedInstant)
      need(same(detail, openingDetails.get(role.id)), 'Closing complete35-field native DTO changed')
      const publicResponse = await read(role.nativeLandingURL, 'role'), carrier = publicCarrier(publicResponse.raw, role, detail.originalNativeDetail)
      need(same(carrier, openingCarriers.get(role.id)), 'Closing complete public native data changed')
      const observation = audit.observations.find(row => row.id === role.id)
      observation.closing = {...clone(detail), rawEntitySHA256: response.receipt.rawEntitySHA256}
      observation.publicClosing = {...clone(carrier), rawEntitySHA256: publicResponse.receipt.rawEntitySHA256}
      observation.qualified = true
    }
    check(); need(audit.rawPages.length === 48, 'Complete closing physical schedule required')
    // Qualification can finish after an expiry boundary. Recheck availability
    // against elapsed monotonic source time as well as the captured clock.
    const returnInstant = observedInstant + BigInt(Math.ceil(performance.now() - began)) * 1000n
    const jobs = []
    for (const role of profile.reviewedSelectedRoles) {
      const job = openingDetails.get(role.id).originalNativeDetail, carrier = openingCarriers.get(role.id)
      if (nativeKukuInstant(job.valid_through) <= returnInstant) {
        audit.exclusions.push({id: role.id, reason: 'explicit-native-valid-through-expired', nativeValidThrough: job.valid_through})
        continue
      }
      const description = completeDescription(job)
      jobs.push({source: 'kukufm', company: 'Kuku FM', companyName: 'Kuku FM', title: job.title,
        jobId: String(job.id), requisitionId: String(job.id), sourceNativeUUID: job.uuid,
        sourceUrl: carrier.sourceURL, nativeJobLandingURL: carrier.sourceURL, applyUrl: null, link: null,
        country: job.country, countryCode: 'IN', schemaCountry: null, location: job.location, city: null, state: null,
        companyDomain: null, companyCareerPage: 'https://kukuapp.in/careers/open-roles/', atsPlatform: 'pyjamahr',
        sourceHistoricalCorporateContext: 'https://kukuapp.in/careers/open-roles/', sourceNativeCompanyWebsite: profile.reviewedNativeCompany.url,
        department: job.department_name, employmentType: job.job_type === 'INTERN' ? 'Internship' : 'Full-time',
        remoteStatus: job.remote ? 'Remote' : 'On-site', requiredSkills: clone(job.skill), minimumQualification: job.education.join('; ') || null,
        experienceRequired: job.min_experience + ' - ' + job.max_experience + ' years',
        jobDescription: description, sourceDescription: description, postingDate: null, postedAt: null,
        sourceNativeCreatedAt: job.created_at, closingDate: job.valid_through, sourceNativeValidThrough: job.valid_through, scrapedAt: observedAt,
        sourceNativeRecord: clone(job), sourceNativeSSR: clone(carrier.originalSSR), sourceOriginalHTML: carrier.originalHTML,
        sourceNativeCompany: clone(profile.reviewedNativeCompany), sourceNativeAPIURL: role.nativeAPIURL,
        sourceNativeQuestions: clone(job.job_screening_questions), sourceDetailComplete: true, sourceNativeTextComplete: true,
        sourceEvidenceScope: 'native-role-criteria-as-data-only', sourceCorporateBindingQualified: false,
        sourceFormalLegalEntityQualified: false, sourceActivationComplete: false, sourceRenderedCriteriaComplete: false,
        sourceApplicationQualificationComplete: false, sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false})
    }
    audit.nativeInventoryPairComplete = true; audit.pairedNativeDetailCount = 6; audit.pairedPublicRoleCount = 6
    audit.unhydratedNativeRecordCount = opening.rows.length - profile.reviewedSelectedRoles.length; audit.returnedIndiaJobs = jobs.length
    audit.physicalRequests = audit.rawPages.length; audit.originalEntityBytes = aggregate; audit.completedAt = new Date().toISOString()
    need(jobs.length > 0, 'No paired unexpired native role; zero inventory remains unverified')
    await observe(onRecords, audit.observations); await observe(onAudit, audit); check()
    const finalInstant = observedInstant + BigInt(Math.ceil(performance.now() - began)) * 1000n
    need(jobs.every(job => nativeKukuInstant(job.sourceNativeValidThrough) > finalInstant),
      'Native expiry crossed during observers; staged output held')
    attachSourceObservationEvidence(jobs, audit)
    Object.defineProperties(jobs, {sourceAudit: {value: audit}, nativeCollectionEvidence: {value: audit, configurable: true}})
    return attachInventoryEvidence(jobs, {status: 'coverage-gap', surface: profile.nativeBoard.requestedURL, firstParty: true,
      listingComplete: false, lifecycleCleanupAllowed: false, reportedTotal: null, indiaFacetCount: null, pagesFetched: 8,
      verifiedAt: observedAt, reason: 'Six finite native role criteria-as-data pairs; corporate/legal/rendered/application/company/cleanup scope held.'})
  } catch (error) {
    caller?.throwIfAborted()
    audit.physicalRequests = audit.rawPages.length; audit.originalEntityBytes = aggregate; audit.completedAt = new Date().toISOString()
    if (error && typeof error === 'object' && Object.isExtensible(error)) {
      if (!Object.hasOwn(error, 'softFailure')) Object.assign(error, {softFailure: true, failureKind: 'coverage_gap', sourceScopeComplete: false, lifecycleCleanupAllowed: false})
      for (const key of ['nativeCollectionEvidence', 'recruitmentObservations']) Object.defineProperty(error, key, {value: audit, configurable: true})
    }
    throw error
  } finally {stopSource()}
}})
export const createKukuFMScraper = createCurrentKukuFMScraper
export const run = options => createCurrentKukuFMScraper().run(options)
