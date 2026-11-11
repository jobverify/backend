import { createHash } from 'node:crypto'
import { decodeHTML } from 'entities'
import { nativeCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const PRIMARY = 'https://careers.epam.com/en/jobs/india'
const API = 'https://careers.epam.com/api/jobs/v2/search/careers-i18n'
const INDIA = '4060741400035606931'
const TENANTS = new Set(['anywhere', 'epamgdo', 'careers-india'])
// Exact original public clients. The second release removes SELECTED_FILTERS
// from its constants module; the remaining parsed program is unchanged.
// The November 11 client adds initial facet context and changes application
// analytics/logging; the reviewed native search transport remains unchanged.
// Unknown programs still cannot establish the native search contract.
const CONTROLLER_SHA256S = new Set([
  '66f26b113cd0ae5c02536ebfaab2826ed4f17b85d567319a7af6edb0db9f9678',
  'dec7833162b39f8f5c3aa8dc876875c7982775d0e8b724dd254b178ca3e52d12',
  'c6769eb0c0fdf432f63afb1204e9c9b81594ebaea3fc4144e0c0039aeebe6c4b',
])
const EVIDENCE = Symbol.for('jobverify.epam-native-inventory')
export const NATIVE_PAGE_SIZE = 50
export const nativeSearchUrl = offset => `${API}?facets=country%3D${INDIA}&from=${offset}&lang=en&size=50&sortBy=relevance%3Brelocation%3Dasc&websiteLocale=en-us`
const norm = value => typeof value === 'string' ? decodeHTML(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim() : ''
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const requireNative = (condition, code) => { if (!condition) throw Object.assign(new Error(code), { code }) }
const stable = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item)
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

// Await every asynchronous boundary against the caller's cancellation, including
// readers/transports that ignore or replace the signal. Only the winning read
// can update evidence; late promises have handlers but no state-changing callback.
export function awaitEpamRead(operation, signal, callerSignal) {
  if (callerSignal?.aborted) return Promise.reject(callerSignal.reason)
  if (signal?.aborted) return Promise.reject(signal.reason)
  return new Promise((resolve, reject) => {
    let settled = false
    const done = (error, value) => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', abort)
      if (callerSignal?.aborted) reject(callerSignal.reason)
      else if (signal?.aborted) reject(signal.reason)
      else if (error) reject(value)
      else resolve(value)
    }
    const abort = () => done(true, signal.reason)
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) return abort()
    Promise.resolve().then(() => {
      if (settled) return
      if (callerSignal?.aborted) throw callerSignal.reason
      if (signal?.aborted) throw signal.reason
      return operation()
    }).then(value => done(false, value), error => done(true, error))
  })
}

function primary(html) {
  const matches = [...html.matchAll(/<script\b[^>]*\bid="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/g)]
  requireNative(matches.length === 1, 'primary-page-data-missing-or-ambiguous')
  const data = JSON.parse(matches[0][1]), props = data.props?.pageProps
  requireNative(data.page === '/jobs/[slug]' && data.query?.slug === 'india'
    && props?.canonicalPath === PRIMARY && props.contentType === 'anywhere_pages_jobs'
    && props.locale === 'en-us', 'primary-employer-route-changed')
  const settings = props.cmsPageData?.settings?.location
  requireNative(Array.isArray(settings) && settings.length === 1 && settings[0].id === INDIA
    && settings[0].name === 'India', 'primary-native-country-scope-changed')
  const environment = [...html.matchAll(/APP_ENV_VARIABLES\s*=\s*Object\.assign\(window\.APP_ENV_VARIABLES\s*\|\|\s*\{\},\s*(\{[^<]*?\})\);/g)]
  requireNative(environment.length === 1, 'primary-tenant-configuration-missing')
  const env = JSON.parse(environment[0][1])
  requireNative(env.TENANT_NAME === 'anywhere' && env.API_HOST === '' && env.NODE_ENV === 'production', 'primary-native-tenant-changed')
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"<>]+)"[^>]*>/g)]
    .map(match => match[1]).filter(src => /^\/_next\/static\/chunks\/pages\/_app-[a-f0-9]+\.js$/.test(src))
  requireNative(scripts.length === 1, 'primary-native-controller-missing-or-ambiguous')
  // The current India page carries both universes: jobs is country-scoped,
  // initialJobs is the unfiltered feed used by the country controls. They are
  // deliberately different and the global native facet independently counts
  // every record matching the typed India country array.
  const initial = props.jobs, unfiltered = props.initialJobs
  requireNative(initial && Number.isSafeInteger(initial.total) && initial.total >= 0
    && Array.isArray(initial.jobs) && initial.jobs.length <= 10
    && unfiltered && Number.isSafeInteger(unfiltered.total) && unfiltered.total >= initial.total
    && Array.isArray(unfiltered.jobs), 'primary-native-inventory-unavailable')
  const indiaCounter = unfiltered.facets?.country?.filter(country => country.id === INDIA)
  requireNative(Array.isArray(indiaCounter) && indiaCounter.length === 1 && indiaCounter[0].key === 'India'
    && indiaCounter[0].doc_count === initial.total, 'primary-global-india-counter-missing-or-contradictory')
  return { controller: new URL(scripts[0], PRIMARY).toString(), total: initial.total,
    firstRecords: initial.jobs, countryScope: settings, globalReportedTotal: unfiltered.total,
    globalIndiaFacetCount: indiaCounter[0].doc_count }
}

function envelope(text, expectedTotal) {
  const payload = JSON.parse(text), data = payload?.data
  requireNative(data && !payload.error && payload.success !== false && Array.isArray(data.jobs)
    && data.jobs.length <= NATIVE_PAGE_SIZE && Number.isSafeInteger(data.total)
    && data.total >= 0, 'native-listing-envelope-invalid')
  requireNative(data.total === expectedTotal, 'native-reported-total-changed')
  const facet = data.facets?.country?.filter(country => country.id === INDIA)
  requireNative(Array.isArray(facet) && facet.length === 1 && facet[0].key === 'India'
    && facet[0].doc_count === data.total, 'native-india-counter-missing-or-contradictory')
  return data
}

function identity(record) {
  requireNative(record && typeof record === 'object' && !Array.isArray(record)
    && typeof record.uid === 'string' && /^[a-zA-Z0-9_-]+$/.test(record.uid)
    && TENANTS.has(record.tenant) && record.locale === 'en-us'
    && record.unique_id === `${record.tenant}_${record.uid}_${record.locale}`
    && norm(record.name), 'native-role-identity-or-tenant-invalid')
  requireNative(record.is_hidden === false && record.is_expired === false
    && Array.isArray(record.environments) && record.environments.includes('careers'), 'native-role-not-public-and-current')
  requireNative(typeof record.seo?.url === 'string', 'native-role-url-missing')
  const url = new URL(record.seo.url, PRIMARY)
  requireNative(url.origin === 'https://careers.epam.com' && !url.search && !url.hash
    && !url.username && !url.password && /^\/[a-z]{2}\/vacancy\/[^/]+$/.test(url.pathname)
    && url.pathname.endsWith(`-${record.uid}_en`), 'native-role-url-foreign-or-inconsistent')
  return { id: record.unique_id, url: url.toString() }
}

function locations(record) {
  const declared = record.country
  requireNative(Array.isArray(declared) && declared.length > 0 && declared.length <= 100, 'native-countries-missing')
  const byID = new Map()
  for (const country of declared) {
    const canonical = nativeCountryName(country?.name)
    requireNative(typeof country?.id === 'string' && country.id && canonical
      && (country.type == null || country.type === 'Country')
      && (country.id === INDIA) === (canonical === 'India') && !byID.has(country.id), 'native-country-unknown-or-contradictory')
    byID.set(country.id, { ...country, canonical })
  }
  const cities = record.city ?? []
  requireNative(Array.isArray(cities) && cities.length <= 200, 'native-city-array-invalid')
  const indiaCities = []
  for (const city of cities) {
    const country = city?.country, known = byID.get(country?.id)
    requireNative(norm(city?.name) && known && nativeCountryName(country.name) === known.canonical
      && (country.type == null || country.type === 'Country'), 'native-city-country-unknown-or-contradictory')
    if (known.canonical === 'India') indiaCities.push(norm(city.name))
  }
  if (record.metadata?.country != null) {
    requireNative(Array.isArray(record.metadata.country)
      && record.metadata.country.length === byID.size
      && new Set(record.metadata.country.map(country => country.id)).size === byID.size
      && record.metadata.country.every(country => byID.get(country.id)?.canonical === nativeCountryName(country.title)),
    'native-country-metadata-contradictory')
  }
  // Unknown newly introduced workplace fields cannot be silently discarded.
  requireNative(!Object.keys(record).some(key => /(?:location|countr|cit(?:y|ies))/i.test(key)
    && !['country', 'city', 'relocation', 'relocation_destination'].includes(key)), 'native-unreviewed-location-field')
  requireNative(byID.has(INDIA), 'native-country-query-returned-non-india-role')
  return { countries: declared, indiaCities: [...new Set(indiaCities)], location: indiaCities.length
    ? `${[...new Set(indiaCities)].join('; ')}, India` : 'India' }
}

function fullDescription(record) {
  const text = norm(record.text), introduction = norm(record.description)
  requireNative(text && introduction && text.includes(introduction) && record.category
    && typeof record.category === 'object' && !Array.isArray(record.category), 'native-full-description-missing')
  let roleSections = 0
  for (const value of Object.values(record.category)) {
    if (value == null) continue
    const parts = Array.isArray(value) ? value : [value]
    for (const part of parts) {
      const section = norm(part)
      requireNative(section && text.includes(section), 'native-full-description-section-missing')
      roleSections++
    }
  }
  requireNative(roleSections > 0, 'native-full-description-role-sections-missing')
  const supplements = []
  for (const field of ['benefits', 'disclaimers']) {
    requireNative(record[field] == null || Array.isArray(record[field]), 'native-description-supplement-invalid')
    for (const supplement of record[field] || []) {
      requireNative(typeof supplement?.content === 'string' && norm(supplement.content), 'native-description-supplement-missing')
      supplements.push(norm(supplement.content))
    }
  }
  return [text, ...supplements].join('\n\n')
}

function nativeWorkArrangement(record) {
  // Pinned client module 34123 distinguishes Office, Remote and Hybrid in its
  // JobPosting producer. Reconcile the raw value with its native English label;
  // new or contradictory workplace representations remain explicitly unknown.
  const label = record.vacancy_type, localized = record.metadata?.vacancy_type
  const workplaceKey = /remote|hybrid|arrangement|work[_-]?(?:mode|place|from[_-]?home)|telecommut|onsite|on_site|vacancy[_-]?type/i
  if (!['Office', 'Remote', 'Hybrid'].includes(label)
    || !record.metadata || typeof record.metadata !== 'object' || Array.isArray(record.metadata)
    || Object.keys(record).some(key => key !== 'vacancy_type' && workplaceKey.test(key))
    || Object.keys(record.metadata).some(key => key !== 'vacancy_type' && workplaceKey.test(key))
    || !Array.isArray(localized) || localized.length !== 1
    || !localized[0] || typeof localized[0] !== 'object' || Array.isArray(localized[0])
    || Object.keys(localized[0]).some(key => !['title', 'locale'].includes(key))
    || localized[0].title !== label || localized[0].locale !== 'en-us') return null
  return { Office: 'On-site', Remote: 'Remote', Hybrid: 'Hybrid' }[label]
}

function limit(options, name, fallback) {
  const value = options[name] ?? fallback
  if (!Number.isSafeInteger(value) || value <= 0) throw new RangeError(`Invalid EPAM ${name}`)
  return value
}

export async function runNativeEpam({ options, maxJobs, project, headers }) {
  const callerSignal = options.signal
  callerSignal?.throwIfAborted()
  const limits = {
    maxRequests: Math.min(limit(options, 'maxRequests', 64), 128),
    maxPages: Math.min(limit(options, 'maxPages', 24), 48),
    maxAggregateBytes: Math.min(limit(options, 'maxAggregateBytes', 32 * 1024 * 1024), 64 * 1024 * 1024),
    maxResponseBytes: Math.min(limit(options, 'maxResponseBytes', 4 * 1024 * 1024), 8 * 1024 * 1024),
    requestTimeoutMs: Math.min(limit(options, 'requestTimeoutMs', 20000), 30000),
    totalTimeoutMs: Math.min(limit(options, 'totalTimeoutMs', 90000), 120000),
    concurrency: 1, nativePageSize: NATIVE_PAGE_SIZE,
  }
  const requestedMaxJobs = options.maxJobs ?? maxJobs
  if (requestedMaxJobs != null && (!Number.isSafeInteger(requestedMaxJobs) || requestedMaxJobs < 0)) throw new RangeError('Invalid EPAM maxJobs')
  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(Object.assign(new Error('EPAM collection deadline reached'), { code: 'total-timeout' })), limits.totalTimeoutMs)
  const signal = AbortSignal.any([...(callerSignal ? [callerSignal] : []), timeout.signal])
  const result = { scope: 'current-employer-advertised-native-India-country-feed',
    unknownScopes: ['unpublished-or-private-requisitions', 'other-tenant-or-non-careers-publication-channels'],
    countryProof: 'every-declared-native-country-and-city-country;query-is-not-location-evidence',
    limits, handoffVerified: false, controllerVerified: false, closingMatches: false,
    cleanupAllowed: false, complete: false, requests: 0, aggregateBytes: 0,
    passes: [], failures: [], bodyGaps: [], retainedResponses: [], invalidRecords: [] }
  const jobsByID = new Map()
  const closingWorkArrangements = new Map()
  const fail = (stage, error, extra = {}) => result.failures.push({ stage,
    code: typeof error?.code === 'string' ? error.code : 'native-read-failed',
    message: String(error?.message || error).slice(0, 240), ...extra })
  const check = () => { callerSignal?.throwIfAborted(); signal.throwIfAborted() }
  const transport = options.transport || options.fetchImpl || fetch
  const read = async (url, type, stage) => {
    check()
    requireNative(result.requests < limits.maxRequests, 'request-limit')
    requireNative(result.aggregateBytes < limits.maxAggregateBytes, 'aggregate-byte-limit')
    result.requests++
    const requestedAt = new Date().toISOString(), attempt = new AbortController()
    const deadline = setTimeout(() => attempt.abort(Object.assign(new Error('EPAM request deadline reached'), { code: 'request-timeout' })), limits.requestTimeoutMs)
    const readSignal = AbortSignal.any([signal, attempt.signal])
    let reader
    try {
      const response = await awaitEpamRead(() => transport(url, { method: 'GET', redirect: 'manual', signal: readSignal,
        headers: { ...headers, Accept: type, Referer: PRIMARY, 'x-anywhere-tenant': 'anywhere' } }), readSignal, callerSignal)
      check()
      const header = response.headers?.get?.('content-type') || response.headers?.['content-type'] || ''
      let bytes
      if (Buffer.isBuffer(response.body) || typeof response.body === 'string' || response.body instanceof Uint8Array) {
        bytes = Buffer.from(response.body)
      } else if (response.body?.getReader) {
        reader = response.body.getReader()
        const chunks = [], maximum = Math.min(limits.maxResponseBytes, limits.maxAggregateBytes - result.aggregateBytes)
        let count = 0
        while (true) {
          const chunk = await awaitEpamRead(() => reader.read(), readSignal, callerSignal)
          if (chunk.done) break
          count += chunk.value.byteLength
          requireNative(count <= maximum, 'response-byte-limit')
          chunks.push(Buffer.from(chunk.value))
        }
        bytes = Buffer.concat(chunks)
      } else if (typeof response.arrayBuffer === 'function') {
        bytes = Buffer.from(await awaitEpamRead(() => response.arrayBuffer(), readSignal, callerSignal))
      } else throw Object.assign(new Error('Native response body reader missing'), { code: 'body-reader-missing' })
      check()
      requireNative(bytes.length <= limits.maxResponseBytes, 'response-byte-limit')
      requireNative(result.aggregateBytes + bytes.length <= limits.maxAggregateBytes, 'aggregate-byte-limit')
      result.aggregateBytes += bytes.length
      result.retainedResponses.push({ url, finalUrl: response.url || null, status: response.status,
        contentType: header, bodyBytes: bytes.length, bodySHA256: sha(bytes), rawBodyBase64: bytes.toString('base64'),
        requestedAt, completedAt: new Date().toISOString(), provenance: response.provenance || 'native-public-GET',
        bodyRepresentation: 'complete decoded HTTP response body; not compressed wire bytes', stage })
      requireNative(response.url === url && response.status === 200, 'native-http-status-or-final-url-changed')
      requireNative(header.split(';')[0].trim().toLowerCase() === type
        || type === 'application/javascript' && header.split(';')[0].trim().toLowerCase() === 'text/javascript', 'native-content-type-changed')
      return bytes.toString('utf8')
    } finally {
      clearTimeout(deadline)
      // Cancellation of an uncooperative reader must never delay caller abort.
      if (reader) { try { Promise.resolve(reader.cancel()).catch(() => {}) } catch {} }
    }
  }
  try {
    const opening = primary(await read(PRIMARY, 'text/html', 'opening-primary'))
    result.handoffVerified = true
    result.reportedTotal = opening.total
    result.globalReportedTotal = opening.globalReportedTotal
    result.globalIndiaFacetCount = opening.globalIndiaFacetCount
    const controller = await read(opening.controller, 'application/javascript', 'public-controller')
    requireNative(CONTROLLER_SHA256S.has(sha(Buffer.from(controller))), 'native-public-controller-changed')
    result.controllerVerified = true
    const collectPass = async name => {
      const pass = { name, rawCount: 0, uniqueCount: 0, paginationComplete: false, pages: [], records: new Map() }
      const publicIdentities = new Set()
      const rawIdentities = new Set()
      result.passes.push(pass)
      while (pass.rawCount < opening.total || pass.pages.length === 0) {
        if (pass.pages.length >= limits.maxPages) { fail(name, { code: 'page-limit', message: 'Native page limit reached' }); break }
        const offset = pass.rawCount, url = nativeSearchUrl(offset)
        let data
        try { data = envelope(await read(url, 'application/json', name), opening.total) }
        catch (error) { check(); fail(name, error, { url, offset }); break }
        pass.pages.push({ offset, rawCount: data.jobs.length, reportedTotal: data.total,
          ids: data.jobs.map(record => record?.unique_id ?? null) })
        if (offset === 0) {
          const prefix = data.jobs.slice(0, opening.firstRecords.length)
          // A native service can cap pages below the primary's ten-row preview.
          if (stable(prefix) !== stable(opening.firstRecords.slice(0, prefix.length))) {
            fail(name, { code: 'primary-listing-content-mismatch', message: 'Primary preview and current native rows differ' })
          }
        }
        pass.rawCount += data.jobs.length
        if (pass.rawCount > opening.total) fail(name, { code: 'native-count-overflow', message: 'Native rows exceed reported total' })
        for (const raw of data.jobs) {
          const record = freeze(structuredClone(raw))
          let closingMode
          if (name === 'closing' && typeof record?.uid === 'string') {
            closingMode = closingWorkArrangements.get(record.uid) || { observations: 0 }
            closingMode.observations++
            closingMode.nativeUniqueId = null
            closingMode.remoteStatus = null
            closingWorkArrangements.set(record.uid, closingMode)
          }
          if (typeof record?.unique_id === 'string' && record.unique_id) rawIdentities.add(record.unique_id)
          try {
            const key = identity(record)
            requireNative(!pass.records.has(key.id), 'duplicate-native-identity')
            requireNative(!publicIdentities.has(record.uid) && !publicIdentities.has(key.url), 'conflicting-native-public-identity')
            publicIdentities.add(record.uid)
            publicIdentities.add(key.url)
            pass.records.set(key.id, sha(stable(record)))
            const geography = locations(record)
            if (closingMode?.observations === 1) {
              closingMode.nativeUniqueId = key.id
              closingMode.remoteStatus = nativeWorkArrangement(record)
            }
            let description = null, detailComplete = true
            try { description = fullDescription(record) }
            catch (error) {
              detailComplete = false
              fail(name, error, { id: key.id })
              if (name === 'opening') result.bodyGaps.push({ id: key.id, nativeRecord: record, reason: error.code })
            }
            if (name === 'opening') {
              const projected = project(record)
              requireNative(projected, 'native-role-projection-failed')
              jobsByID.set(key.id, { ...projected, remoteStatus: nativeWorkArrangement(record), sourceRemoteStatusUnresolved: true,
                sourceUrl: key.url, applyUrl: key.url, country: 'India',
                location: geography.location, city: geography.indiaCities[0] || null,
                jobDescription: description, sourceDetailComplete: detailComplete,
                nativeRecord: record, nativeUniqueId: key.id, nativeDeclaredCountries: geography.countries })
            }
          } catch (error) {
            fail(name, error, { id: typeof record?.unique_id === 'string' ? record.unique_id : null })
            result.invalidRecords.push({ pass: name, offset, reason: error.code || 'invalid-native-record', nativeRecord: record })
          }
        }
        pass.uniqueCount = rawIdentities.size
        pass.validatedIdentityCount = pass.records.size
        if (requestedMaxJobs != null && jobsByID.size >= requestedMaxJobs && requestedMaxJobs < opening.total) {
          fail(name, { code: 'job-limit', message: 'Explicit job limit prevents complete native enumeration' })
          break
        }
        if (data.jobs.length === 0 && pass.rawCount < opening.total) {
          fail(name, { code: 'native-early-empty-page', message: 'Empty raw page precedes the declared native total' })
          break
        }
        if (pass.rawCount >= opening.total) {
          pass.paginationComplete = pass.rawCount === opening.total && pass.uniqueCount === opening.total
          break
        }
      }
      return pass
    }
    const first = await collectPass('opening')
    if (first.paginationComplete) {
      const closing = await collectPass('closing')
      const finalPrimary = primary(await read(PRIMARY, 'text/html', 'closing-primary'))
      result.closingMatches = closing.paginationComplete && first.records.size === closing.records.size
        && [...first.records].every(([id, fingerprint]) => closing.records.get(id) === fingerprint)
        && stable(opening) === stable(finalPrimary)
      if (!result.closingMatches) fail('closing-consistency', { code: 'native-closing-inventory-changed', message: 'Native role identities, content or primary scope changed during collection' })
    }
    result.complete = result.handoffVerified && result.controllerVerified && result.closingMatches
      && result.failures.length === 0
    result.cleanupAllowed = result.complete
  } catch (error) {
    if (callerSignal?.aborted) throw callerSignal.reason
    fail('native-inventory', error)
  } finally { clearTimeout(timer) }
  callerSignal?.throwIfAborted()
  const complete = result.complete
  const jobs = [...jobsByID.values()].slice(0, requestedMaxJobs ?? jobsByID.size).map(job => {
    const closingMode = closingWorkArrangements.get(job.jobId)
    return { ...job, remoteStatus: closingMode?.observations === 1
      && closingMode.nativeUniqueId === job.nativeUniqueId && closingMode.remoteStatus === job.remoteStatus ? job.remoteStatus : null,
    source: 'epam', link: job.applyUrl, scrapedAt: new Date().toISOString(),
    sourceListingComplete: complete, sourceScopeComplete: complete, lifecycleCleanupAllowed: complete }
  })
  result.passes = result.passes.map(({ records, ...pass }) => ({ ...pass, fingerprints: Object.fromEntries(records) }))
  const verifiedAt = complete ? result.retainedResponses.at(-1).completedAt : null
  result.verifiedAt = verifiedAt
  // These are observed collection counts consumed by runner health checks.
  // Candidate roles come from validated opening records; explicit selection
  // limits therefore leave a real candidate/returned-count gap.
  Object.assign(result, { source: 'epam',
    observedListingCount: result.passes[0]?.rawCount ?? 0,
    candidateDetails: jobsByID.size,
    extractedDetailJobs: jobs.length,
    excludedDetailJobs: 0,
    listingPaginationComplete: result.passes[0]?.paginationComplete === true,
    closingInventoryMatches: result.closingMatches,
    sourceScopeComplete: complete,
    firstExtractedJobID: jobs[0]?.jobId ?? null,
  })
  attachInventoryEvidence(jobs, { status: complete ? jobs.length ? 'complete-inventory' : 'verified-empty' : 'coverage-gap',
    firstParty: result.handoffVerified, surface: nativeSearchUrl(0), listingComplete: complete,
    pagesFetched: result.passes.reduce((sum, pass) => sum + pass.pages.length, 0),
    reportedTotal: result.reportedTotal ?? null, indiaFacetCount: complete ? result.reportedTotal : null, verifiedAt,
    reason: complete ? 'current-official-native-India-feed;all-declared-countries-and-full-content;two-complete-native-reads-and-stable-primary'
      : `native-India-inventory-incomplete;cleanup-forbidden;failures=${result.failures.length}` })
  const batch = freeze(result)
  Object.defineProperty(jobs, EVIDENCE, { value: batch })
  // Provider decoration maps the array. The existing per-job evidence convention
  // carries the full immutable native batch through that registered boundary.
  if (jobs[0]) jobs[0].nativeCollectionEvidence = batch
  return jobs
}
