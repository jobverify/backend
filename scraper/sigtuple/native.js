import { createHash } from 'node:crypto'

import { createHTMLTransport, HTML_REQUEST_TIMEOUT_MS, MAX_HTML_BYTES } from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import { requireNative } from '../../scraper-support/shared/nativeJobPosting.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { createEmployerBoundWorkableScraper } from '../../scraper-support/utils/workableEmployerInventory.js'

export const HOMEPAGE_URL = 'https://sigtuple.com/'
const ACCOUNT = 'https://apply.workable.com/api/v1/accounts/sigtuple'
const LISTING = 'https://apply.workable.com/api/v3/accounts/sigtuple/jobs'
const DETAIL = /^https:\/\/apply\.workable\.com\/api\/v2\/accounts\/sigtuple\/jobs\/[A-Z0-9]{6,32}$/
const MAX_REQUESTS = 128
const MAX_AGGREGATE_BYTES = 16 * 1024 * 1024
const sha = body => createHash('sha256').update(body).digest('hex')

const validateURL = url => requireNative(url === HOMEPAGE_URL || url === ACCOUNT || url === LISTING || DETAIL.test(url),
  'SigTuple unreviewed request URL')

const engine = createEmployerBoundWorkableScraper({
  source: 'sigtuple', company: 'SigTuple', tenant: 'sigtuple',
  // Observed in the native board meta[name=account], not inferred from a name.
  // It cannot authorize collection without a fresh employer handoff below.
  accountUid: '301bb372-b567-4bfd-afe1-ca0035561689',
  careersUrl: HOMEPAGE_URL, companyDomain: 'sigtuple.com', reconcileClosingInventory: true,
})

export const createSigtupleNativeScraper = (defaults = {}) => ({
  async run(options = {}) {
    const settings = { ...defaults, ...options }
    settings.signal?.throwIfAborted()
    const signal = AbortSignal.any([...(settings.signal ? [settings.signal] : []), AbortSignal.timeout(120000)])
    const timeoutMs = settings.timeoutMs ?? HTML_REQUEST_TIMEOUT_MS
    requireNative(Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= HTML_REQUEST_TIMEOUT_MS,
      'SigTuple invalid request timeout')
    const maxPages = settings.maxPages ?? 32
    requireNative(Number.isSafeInteger(maxPages) && maxPages > 0 && maxPages <= 32, 'SigTuple invalid page bound')
    const evidence = { source: 'sigtuple', status: 'unavailable', handoffVerified: false,
      nativeBoardListingComplete: false, nativeReportedTotal: null, rawJobs: null, indiaJobs: null,
      eligibleJobs: null, savedJobs: null, visibleJobs: null, sourceScopeComplete: false,
      wholeCompanyScope: false, cleanupAllowed: false, verifiedZeroInventory: false,
      retainedResponses: [], failures: [] }
    const details = new Map(), records = new Map()
    let count = 0, aggregateBytes = 0
    const read = async (url, init = {}) => {
      validateURL(url); signal.throwIfAborted()
      requireNative(++count <= MAX_REQUESTS, 'SigTuple native request bound')
      const method = init.method || 'GET'
      requireNative(method === 'GET' && url !== LISTING || method === 'POST' && url === LISTING,
        'SigTuple unreviewed request method')
      if (method === 'POST') {
        const query = JSON.parse(init.body)
        const { token, ...filters } = query
        requireNative(JSON.stringify(filters) === JSON.stringify({ query: '', location: [], department: [], worktype: [], remote: [] })
          && (token === undefined || typeof token === 'string' && token.length > 0 && token.length <= 4096),
        'SigTuple native query changes board scope')
      }
      // Reuse the stream/deadline/identity protections for GETs and the single
      // read-only unfiltered Workable listing POST. No application is visited.
      const transport = createHTMLTransport({ validateURL,
        expectedContentType: current => current === HOMEPAGE_URL ? 'text/html' : 'application/json' }, {
        signal, timeoutMs, fetchImpl: async (current, transportInit) => (settings.fetchImpl || globalThis.fetch)(current, {
          ...transportInit, method, ...(method === 'POST' ? { body: init.body,
            headers: { ...transportInit.headers, 'Content-Type': 'application/json' } } : {}),
        }),
      })
      const response = await transport(url)
      const body = Buffer.from(response.body)
      aggregateBytes += body.length
      requireNative(body.length <= MAX_HTML_BYTES && aggregateBytes <= MAX_AGGREGATE_BYTES, 'SigTuple aggregate body bound')
      evidence.retainedResponses.push({ url, method, requestBody: init.body ?? null, status: response.status,
        headers: response.headers, bodyBytes: body.length, bodySHA256: sha(body), rawBodyBase64: body.toString('base64'),
        bodyRepresentation: 'complete decoded public HTTP response body',
        requestedAt: response.requestedAt, completedAt: response.completedAt })
      requireNative(response.status === 200, 'SigTuple native HTTP ' + response.status + '; redirects and challenges are unavailable')
      requireNative(response.headers['content-type']?.split(';')[0].trim().toLowerCase()
        === (url === HOMEPAGE_URL ? 'text/html' : 'application/json'), 'SigTuple unexpected native content type')
      const text = new TextDecoder('utf-8', { fatal: true }).decode(body)
      requireNative(text.trim(), 'SigTuple empty native response')
      return text
    }
    try {
      const jobs = await engine.run({ signal, maxPages, maxJobs: settings.maxJobs ?? 0, now: settings.now,
        fetchPage: async url => ({ status: 200, url, html: await read(url) }),
        fetchJson: async (url, init) => {
          // The shared engine requests this only after finding the visible,
          // active, full-board link on the current official company document.
          if (url === ACCOUNT) evidence.handoffVerified = true
          const payload = JSON.parse(await read(url, init))
          if (url === LISTING) for (const row of payload?.results || []) records.set(row.shortcode, row)
          else if (DETAIL.test(url)) details.set(url.split('/').at(-1), payload)
          return payload
        },
      })
      signal.throwIfAborted()
      const native = readInventoryEvidence(jobs)
      Object.assign(evidence, { status: 'native-board-read-company-scope-unresolved',
        nativeBoardListingComplete: native?.listingComplete === true,
        nativeReportedTotal: native?.reportedTotal ?? null, rawJobs: native?.reportedTotal ?? null,
        indiaJobs: native?.indiaFacetCount ?? null, nativeInventoryEvidence: native })
      // This source currently has no company-selected recruiting handoff. Even
      // a future bound board cannot by itself prove company-wide scope. Keep
      // native counts separate and prohibit lifecycle cleanup until scoped.
      if (!jobs.length) throw new Error('SigTuple current company inventory unresolved; native board zero/foreign-only is not whole-company empty')
      const output = jobs.map((job, index) => {
        const detail = details.get(job.jobId), record = records.get(job.jobId)
        const publication = detail?.published ?? record?.published ?? null
        const original = ['description', 'requirements', 'benefits'].map(key => detail[key]).filter(value => typeof value === 'string' && value).join('\n')
        return { ...job, jobDescription: original, sourceDescription: original,
          postingDate: publication, postedAt: publication, nativePublicationDate: publication,
          sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false,
          nativeCollectionEvidence: index === 0 ? evidence : { source: 'sigtuple', firstExtractedJobID: jobs[0].jobId,
            sourceScopeComplete: false, cleanupAllowed: false, nativeBoardListingComplete: evidence.nativeBoardListingComplete } }
      })
      return attachInventoryEvidence(output, { status: 'coverage-gap', surface: LISTING,
        firstParty: evidence.handoffVerified, listingComplete: false, pagesFetched: native?.pagesFetched ?? 0,
        reportedTotal: evidence.rawJobs, indiaFacetCount: evidence.indiaJobs, verifiedAt: null,
        reason: 'current-employer-handoff-and-native-role-details-read;whole-company-scope-unresolved;cleanup-forbidden' })
    } catch (error) {
      settings.signal?.throwIfAborted(); signal.throwIfAborted()
      evidence.failures.push({ stage: evidence.handoffVerified ? 'native-inventory' : 'current-employer-handoff',
        message: error.message })
      throw Object.assign(new Error('SigTuple native collection incomplete: ' + error.message), {
        name: 'SigTupleNativeIncompleteError', code: 'SIGTUPLE_NATIVE_INCOMPLETE', failureKind: 'coverage_gap',
        softFailure: true, abortRetries: true, nativeEvidence: evidence,
      })
    }
  },
})
