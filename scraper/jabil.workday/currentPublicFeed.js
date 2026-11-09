import { createHash } from 'node:crypto'
import { readNativeDocument, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { mapWithConcurrency } from '../../scraper-support/utils/mapWithConcurrency.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const CORPORATE = 'https://www.jabil.com/'
const CAREERS = 'https://careers.jabil.com/'
const SEARCH = CAREERS + 'jobs.html'
const LIST = CAREERS + '.rest/delivery/jobs?all=true&slim=true'
const DETAIL = CAREERS + '.rest/delivery/jobs?jobId='
const CLIENT_HASH = '4871cf4a25efe2f4a6338a7293e4d9da6810b06520d618591729d521e0241cb2'
const places = row => row?.All_Job_Posting_Locations_for_Job_Requisition_group
const indiaPlaces = row => Array.isArray(places(row)) ? places(row).filter(place => place['Location_Address_-_Country'] === 'India') : []
const need = (condition, message) => {
  if (!condition) throw Object.assign(new Error('Jabil current native feed: ' + message), {
    abortRetries: true, softFailure: true, failureKind: 'coverage_gap', lifecycleCleanupAllowed: false,
  })
}
const link = (doc, base, expected) => doc.nodes(node => {
  if (node.tag !== 'a' || !node.attrs.href) return false
  try { return new URL(node.attrs.href, base).href === expected } catch { return false }
}).length > 0
const shape = payload => {
  need(payload && !payload.error && !payload.errors && Array.isArray(payload.jobs)
    && Number.isSafeInteger(payload.total) && payload.total >= 0 && payload.total <= 10000
    && payload.total === payload.jobs.length && payload.page === 1
    && (payload.totalPages === 1 || payload.total === 0 && payload.totalPages === 0), 'native complete list shape or count changed')
  const ids = new Set()
  for (const row of payload.jobs) {
    need(/^J\d{6,}$/.test(row?.Job_Requisition_ID || '') && !ids.has(row.Job_Requisition_ID)
      && typeof row.Job_Posting_Title === 'string' && row.Job_Posting_Title.trim()
      && Array.isArray(places(row)) && places(row).length > 0, 'native listing identity or location shape changed')
    ids.add(row.Job_Requisition_ID)
  }
  return payload.jobs
}

export async function runCurrentJabilFeed(options = {}) {
  options.signal?.throwIfAborted()
  const controller = new AbortController()
  const signal = AbortSignal.any([controller.signal, ...(options.signal ? [options.signal] : []), AbortSignal.timeout(options.sourceTimeoutMs ?? 180000)])
  const transport = { signal, fetchImpl: options.fetchImpl || globalThis.fetch, credentials: 'omit', redirect: 'manual',
    attempts: 3, baseDelayMs: 1000, timeoutMs: 20000, label: 'jabil-public-feed', includeResponseMetadata: true }
  let requests = 0
  const readText = async url => {
    signal.throwIfAborted(); requests++
    const page = await fetchTextWithRetry(url, transport)
    need(page.status === 200 && page.url === url, 'publisher response identity changed')
    return page.html
  }
  const readJson = async url => {
    signal.throwIfAborted(); requests++
    const page = await fetchJsonWithRetry(url, transport)
    need(page.status === 200 && page.url === url, 'native response identity changed')
    return page.payload
  }
  try {
    const corporate = readNativeDocument(await readText(CORPORATE))
    need(link(corporate, CORPORATE, CAREERS), 'current corporate careers handoff unavailable')
    const careers = readNativeDocument(await readText(CAREERS))
    need(link(careers, CAREERS, SEARCH), 'current careers search handoff unavailable')
    const search = readNativeDocument(await readText(SEARCH))
    need(search.nodes(node => search.hasClass(node, 'jobsWorkdayList')).length === 1, 'native search renderer unavailable')
    const clients = search.nodes(node => node.tag === 'script' && node.attrs.src
      && /^\/\.resources\/jabil-main\/themes\/careers\/dist\/common~[\d-]+~cache\.js$/.test(node.attrs.src))
    need(clients.length === 1, 'current declared jobs client unavailable')
    const client = await readText(new URL(clients[0].attrs.src, SEARCH).href)
    need(createHash('sha256').update(client).digest('hex') === CLIENT_HASH, 'current jobs client changed; renderer review required')
    const opening = shape(await readJson(LIST))
    const selected = opening.filter(row => row.Status === 'Open' && indiaPlaces(row).length > 0)
    const jobs = await mapWithConcurrency(selected, 4, async row => {
      const payload = await readJson(DETAIL + row.Job_Requisition_ID)
      need(payload && !payload.error && !payload.errors && Array.isArray(payload.jobs) && payload.jobs.length === 1, 'full native detail unavailable')
      const detail = payload.jobs[0]
      need(detail.Job_Requisition_ID === row.Job_Requisition_ID && detail.Job_Posting_Title === row.Job_Posting_Title,
        'native listing and full detail identity disagree')
      if (detail.Status !== 'Open' || !indiaPlaces(detail).length) return null
      let activeDescription
      try { activeDescription = extractActiveDescription(detail.Job_Description) }
      catch { need(false, 'full native criteria unavailable') }
      need(typeof detail.Job_Description === 'string' && (activeDescription?.length ?? 0) >= 100, 'full native criteria unavailable')
      need(typeof detail.Start_Date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(detail.Start_Date)
        && Number.isFinite(Date.parse(detail.Start_Date))
        && new Date(detail.Start_Date).toISOString().slice(0, 10) === detail.Start_Date, 'native publication date unavailable')
      let apply
      if (typeof detail.External_Apply_URL === 'string') {
        try { apply = new URL(detail.External_Apply_URL) } catch { /* A malformed publisher field is a permanent contract failure. */ }
      }
      need(apply && apply.origin === 'https://jabil.wd5.myworkdayjobs.com' && !apply.username && !apply.password && !apply.search && !apply.hash
        && /^\/Jabil_Careers\/job\/[^/?#]+\/[^/?#]+\/apply$/.test(apply.pathname)
        && apply.pathname.endsWith('_' + detail.Job_Requisition_ID + '/apply'), 'native application board or role identity changed')
      const nativePlaces = indiaPlaces(detail), primary = nativePlaces[0]
      return { source: 'jabil', company: 'Jabil', title: detail.Job_Posting_Title, jobId: detail.Job_Requisition_ID,
        requisitionId: detail.Job_Requisition_ID, country: 'India', city: primary['Location_Address_-_City'] || null,
        location: [primary.Location, 'India'].filter(Boolean).join(', '),
        locations: nativePlaces.map(place => [place.Location, 'India'].filter(Boolean).join(', ')),
        sourceUrl: apply.href, applyUrl: apply.href, link: apply.href,
        sourceDescription: detail.Job_Description, jobDescription: detail.Job_Description,
        postingDate: detail.Start_Date, closingDate: null, employmentType: detail.Time_Type || null,
        department: detail.Job_Family_Group || null, nativeSourceRecord: detail, nativeListingRecord: row,
        sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false,
        companyCareerPage: CAREERS, companyDomain: 'jabil.com', atsPlatform: 'first-party-declared-job-feed+workday',
        scrapedAt: options.now ? options.now() : new Date().toISOString() }
    })
    const closing = shape(await readJson(LIST))
    need(JSON.stringify(closing) === JSON.stringify(opening), 'closing native listing changed')
    const result = jobs.filter(Boolean)
    Object.defineProperty(result, Symbol.for('jobverify.verified-recruitment-observations'), { value: {
      source: 'jabil', requestCount: requests, nativeRecords: opening.length, returnedIndiaJobs: result.length,
      sourceScopeComplete: false, lifecycleCleanupAllowed: false, unresolved: ['whole-company-recruitment-scope-unverified'], failures: [],
      nativeInventoryReads: [{ kind: 'current-first-party-declared-feed', surface: LIST, reportedTotal: opening.length }],
    } })
    return attachInventoryEvidence(result, { status: 'coverage-gap', surface: SEARCH, firstParty: true, listingComplete: false,
      pagesFetched: requests, reportedTotal: null, indiaFacetCount: null, verifiedAt: options.now ? options.now() : new Date().toISOString(),
      reason: 'current-corporate-handoff-and-declared-first-party-list+all-selected-full-details;whole-company-scope-unverified;cleanup-forbidden' })
  } catch (error) {
    options.signal?.throwIfAborted()
    controller.abort(error)
    throw error
  }
}
