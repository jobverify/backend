import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { createHTMLTransport } from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { CORPORATE_CAREERS, GLOBAL_SEARCH, inspectLennoxCorporateDeclaration,
  discoverLennoxIndiaSearches, nextLennoxNativePage, readCurrentLennoxListings,
  readCurrentLennoxDetail } from './currentNative20261111.js'

const need = (condition, message) => {
  if (!condition) throw Object.assign(Error('[lennox] Native acquisition ' + message), { abortRetries: true, code: 'NATIVE_HTML_SHAPE' })
}
const bound = (value, fallback, maximum, label) => {
  const resolved = value ?? fallback
  if (!Number.isSafeInteger(resolved) || resolved < 1 || resolved > maximum) throw RangeError('[lennox] Invalid ' + label)
  return resolved
}
const sha = bytes => createHash('sha256').update(bytes).digest('hex')

export async function runCurrentLennox(options = {}) {
  const requestTimeoutMs = bound(options.requestTimeoutMs, 20000, 20000, 'request deadline')
  const sourceTimeoutMs = bound(options.sourceTimeoutMs, 180000, 180000, 'source deadline')
  const maxRequests = bound(options.maxRequests, 64, 96, 'request budget')
  const maxPages = bound(options.maxPages, 6, 16, 'page budget')
  const maxDetails = bound(options.maxDetails, 24, 100, 'detail budget')
  const maxJobs = options.maxJobs == null ? maxDetails : bound(options.maxJobs, maxDetails, 100, 'result budget')
  need(['fetchText', 'fetchPage', 'fetchJson'].every(key => options[key] == null), 'requires original HTTP response metadata for the current native contract')
  const controller = new AbortController(), caller = options.signal
  caller?.throwIfAborted()
  const signal = caller ? AbortSignal.any([caller, controller.signal]) : controller.signal
  const started = performance.now()
  const expired = () => new DOMException('[lennox] Native source deadline exceeded', 'TimeoutError')
  const timer = setTimeout(() => controller.abort(expired()), sourceTimeoutMs)
  const check = () => {
    caller?.throwIfAborted()
    if (performance.now() - started >= sourceTimeoutMs && !controller.signal.aborted) controller.abort(expired())
    signal.throwIfAborted()
  }
  const permitted = new Set([CORPORATE_CAREERS, GLOBAL_SEARCH]), retainedResponses = [], failures = []
  let aggregateBytes = 0
  const transport = createHTMLTransport({ validateURL: url => need(permitted.has(url), 'undeclared public URL') }, {
    signal, timeoutMs: requestTimeoutMs,
    fetchImpl: (url, init) => (options.fetchImpl ?? globalThis.fetch)(url, {
      ...init, credentials: 'omit', headers: { ...init.headers, 'User-Agent': 'Mozilla/5.0' },
    }),
  })
  const read = async url => {
    check()
    need(permitted.has(url) && retainedResponses.length < maxRequests, 'undeclared URL or request budget exceeded')
    const receipt = { url, method: 'GET', requestedAt: new Date().toISOString(), bodyComplete: false }
    retainedResponses.push(receipt)
    try {
      const packet = await transport(url)
      check()
      const bytes = Buffer.from(packet.body)
      aggregateBytes += bytes.length
      Object.assign(receipt, { status: packet.status, finalURL: packet.url,
        headers: Object.fromEntries(['content-type', 'location', 'date', 'etag', 'last-modified'].map(key => [key, packet.headers[key] ?? null])),
        bodyBytes: bytes.length, bodySHA256: sha(bytes), rawBodyBase64: bytes.toString('base64'), bodyComplete: true })
      need(aggregateBytes <= 16000000, 'aggregate public response budget exceeded')
      if (packet.status !== 200) throw Object.assign(Error('[lennox] Native HTTP ' + packet.status), { status: packet.status, abortRetries: true })
      need(/^text\/html(?:;|$)/i.test(packet.headers['content-type'] ?? ''), 'unexpected public HTML content type')
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch (error) {
      receipt.error = error.message
      check()
      throw error
    } finally { receipt.completedAt = new Date().toISOString() }
  }
  try {
    const declaration = inspectLennoxCorporateDeclaration(await read(CORPORATE_CAREERS))
    const facets = discoverLennoxIndiaSearches(await read(GLOBAL_SEARCH))
    const listingRecords = [], ids = new Map(), openingPages = []
    let pagesFetched = 0
    for (const facet of facets) {
      permitted.add(facet.url)
      let url = facet.url
      const seen = new Set()
      while (url) {
        need(!seen.has(url) && ++pagesFetched <= maxPages, 'native pagination cycle or page budget exceeded')
        seen.add(url)
        const html = await read(url), rows = readCurrentLennoxListings(html)
        openingPages.push({ url, rows })
        for (const row of rows) {
          need(row.country === 'India', 'native India form returned conflicting work countries')
          const previous = ids.get(row.jobId)
          if (previous) { need(isDeepStrictEqual(previous, row), 'conflicting repeated native job identity'); continue }
          ids.set(row.jobId, row)
          listingRecords.push(row)
        }
        url = nextLennoxNativePage(html)
        if (url) {
          // Retain the submitted native India facet when following pagination;
          // changing it would silently leave the observed country scope.
          need(new URL(url).searchParams.get('searchLocation') === facet.nativeValue, 'native pagination lost declared India facet')
          permitted.add(url)
        }
      }
    }
    const jobs = []
    for (const row of listingRecords.slice(0, Math.min(maxJobs, maxDetails))) {
      permitted.add(row.sourceUrl)
      try {
        const job = readCurrentLennoxDetail(await read(row.sourceUrl), row)
        check()
        jobs.push({ ...job, scrapedAt: new Date().toISOString() })
      } catch (error) {
        check()
        failures.push({ stage: 'native-detail', jobId: row.jobId, url: row.sourceUrl, status: error.status ?? null, message: error.message })
      }
    }
    for (const page of openingPages) {
      const closing = readCurrentLennoxListings(await read(page.url))
      need(isDeepStrictEqual(closing, page.rows), 'closing native inventory changed during acquisition')
    }
    need(isDeepStrictEqual(inspectLennoxCorporateDeclaration(await read(CORPORATE_CAREERS)), declaration), 'closing corporate declaration changed')
    check()
    const audit = { source: 'lennox', productionWrites: false, observedListingCount: listingRecords.length,
      observedRecordCount: listingRecords.length, observedVacancyCount: listingRecords.length,
      extractedDetailJobs: jobs.length, omittedDetails: listingRecords.length - jobs.length,
      returnedIndiaJobs: jobs.length, listingRecords, facets, retainedResponses, failures,
      closingNativeInventoryMatches: true, corporateDeclaration: declaration,
      sourceScopeComplete: false, listingPaginationComplete: true, lifecycleCleanupAllowed: false,
      companyGlobalTotal: null, companyIndiaTotal: null, legalEmployerVerified: false,
      limitations: ['Only currently declared India location facets were inspected.',
        'The native hiring organization is preserved; a distinct legal employing entity is not supplied.',
        'Company-wide inventory, unseen vacancies and lifecycle cleanup remain unqualified.'] }
    attachSourceObservationEvidence(jobs, { source: 'lennox', recordKind: 'vacancy-rows',
      observedRecordCount: listingRecords.length, observedVacancyCount: listingRecords.length,
      sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null })
    Object.defineProperty(jobs, 'nativeCollectionEvidence', { value: audit, configurable: true })
    if (jobs.length) jobs[0].nativeCollectionEvidence = audit
    return attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: GLOBAL_SEARCH,
      firstParty: true, listingComplete: false, lifecycleCleanupAllowed: false, pagesFetched,
      reportedTotal: null, indiaFacetCount: null, verifiedAt: new Date().toISOString(),
      reason: jobs.length ? 'Current declared native India facet roles with individually reconciled full criteria; company scope and legal entity remain unqualified.'
        : 'Current native India facet yielded no individually qualified roles; complete inventory and verified zero remain unqualified.' })
  } catch (error) {
    if (caller?.aborted) throw caller.reason
    Object.defineProperty(error, 'nativeEvidence', { configurable: true, value: {
      source: 'lennox', retainedResponses, failures, sourceScopeComplete: false, lifecycleCleanupAllowed: false } })
    throw error
  } finally {
    clearTimeout(timer)
    if (!controller.signal.aborted) controller.abort(Error('[lennox] Native reader closed'))
  }
}
