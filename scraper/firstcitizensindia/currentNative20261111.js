import { createHash } from 'node:crypto'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { nativeCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { withCallerSignal } from '../abmknowledgeware/publicIntake.js'
import { disposeResponseReader } from '../../scraper-support/shared/responseBodyDisposal.js'

const CORPORATE = 'https://www.firstcitizens.com/'
const CAREERS = 'https://jobs.firstcitizens.com/'
const SEARCH = CAREERS + 'jobs'
const API = CAREERS + 'api/jobs'
// This currently declared public renderer whitelists country/page/limit, offers
// page sizes 5/10/25/100, GETs /api/jobs and displays each native data.country.
// 4.11.226 adds X-REQUEST-SOURCE:CST; query/country/pagination semantics remain.
const CLIENTS = Object.freeze({
  'https://app.jibecdn.com/prod/search/4.11.225/main.js': '8fa15e15e8165865026e2f5768af0160b4e1739096302d078e540131894c7f3f',
  'https://app.jibecdn.com/prod/search/4.11.226/main.js': '64df0d1d3d65b28b8ebe0d9ccd08d776ffb092486633fb72f91f26e6c9950f56',
})
const EMPLOYER = 'First Citizens Bank'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
const hash = value => createHash('sha256').update(value).digest('hex')
const need = (value, reason) => {
  if (!value) throw Object.assign(Error('First Citizens current native inventory: ' + reason), { abortRetries: true, code: 'NATIVE_COUNTRY_INVENTORY' })
}
const stable = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item)
const one = (values, label) => { need(values.length === 1, 'one active ' + label + ' required'); return values[0] }
const address = (href, base) => { try { return new URL(href, base).href } catch { return null } }

function declaration(html, url) {
  const doc = readNativeDocument(html)
  const bases = doc.nodes(n => n.tag === 'base')
  need(bases.length <= 1 && bases.every(n => n.attrs.href === '' || n.attrs.href === '/' && address(n.attrs.href, url) === CAREERS),
    'unreviewed document base URL')
  const title = one(doc.nodes(n => n.tag === 'title'), 'publisher title').raw
  const corporate = url === CORPORATE
  need(corporate ? /First Citizens Bank/.test(title) : title === 'First Citizens Careers', 'current publisher identity changed')
  const destination = corporate ? CAREERS : SEARCH
  const links = doc.nodes(n => n.tag === 'a' && address(n.attrs.href, url) === destination
    && doc.text(n) === (corporate ? 'Careers' : 'Search Jobs')).map(n => ({ href: n.attrs.href, text: doc.text(n) }))
  need(links.length > 0, 'current corporate/careers handoff declaration missing')
  if (!corporate) {
    need(one(doc.nodes(n => n.tag === 'link' && n.attrs.rel === 'canonical'), 'careers canonical').attrs.href === url,
      'current careers canonical identity changed')
    need(doc.nodes(n => n.tag === 'script' && !n.attrs.src && /window\._jibe\s*=\s*\{"cid":"firstcitizens"\}/.test(n.raw)).length === 1,
      'current native public client identity changed')
  }
  const clients = url === SEARCH ? doc.nodes(n => n.tag === 'script' && Object.hasOwn(CLIENTS, n.attrs.src)
    && n.attrs.type === 'module' && !Object.hasOwn(n.attrs, 'nomodule')).map(n => n.attrs.src) : []
  if (url === SEARCH) one(clients, 'reviewed native search renderer')
  return { title, links, clients }
}

function country(location) {
  const name = nativeCountryName(location?.country), code = nativeCountryName(location?.country_code)
  need(name && code && name === code, 'native explicit country name/code unavailable or conflicting')
  need(name !== 'India', 'native India role requires complete own-role detail qualification; zero is unavailable')
  return name
}

function rowModel(row) {
  const data = row?.data
  need(data && data.client_code === 'firstcitizens' && data.hiring_organization === EMPLOYER, 'native employer/client identity changed')
  need(/^\d+$/.test(data.slug) && data.req_id === data.slug && typeof data.title === 'string' && data.title.trim()
    && data.language === 'en-us' && data.searchable === true && data.applyable === true && data.internal === false,
  'native public row identity or availability changed')
  const primary = country(data)
  const additional = data.additional_locations ?? []
  need(Array.isArray(additional) && additional.length <= 100
    && typeof data.multipleLocations === 'boolean' && data.multipleLocations === (additional.length > 0),
  'native additional work country inventory unavailable')
  const countries = [primary, ...additional.map(country)]
  return { row, identity: data.slug + ':' + data.language, countries }
}

function pageModel(payload, total) {
  need(payload && !payload.error && Array.isArray(payload.jobs) && Number.isSafeInteger(payload.totalCount)
    // The native filter carries its tenant default (10), even for the
    // renderer's limit=100 requests. Actual page lengths are reconciled below.
    && payload.totalCount > 0 && payload.totalCount === payload.count && payload.filter?.displayLimit === 10,
  'native complete listing count/page contract changed')
  need(total == null || payload.totalCount === total, 'native complete listing count changed across pages')
  return { total: payload.totalCount, rows: payload.jobs.map(rowModel) }
}

const globalURL = page => API + '?page=' + page + '&limit=100'
const indiaURL = API + '?page=1&country=India'
// Search-only hit diagnostics differ when a country filter is applied. Preserve
// every native role field, full criteria and other metadata in the comparison.
const controlSnapshot = row => {
  const { opensearch, ...metadata } = row.data.meta_data || {}
  return stable({ ...row.data, meta_data: metadata })
}

// A zero is qualified only by a complete current native country inventory.
// A future positive India listing fails closed until its own full details can
// be reconciled. A lone empty or misspelled country filter never proves zero.
export async function runCurrentFirstCitizensInventory({ fetchImpl = globalThis.fetch, signal, onAudit,
  now = () => new Date().toISOString(), maxNativePages = 12 } = {}) {
  signal?.throwIfAborted()
  need(Number.isSafeInteger(maxNativePages) && maxNativePages >= 1 && maxNativePages <= 12, 'invalid native page budget')
  const deadline = signal ? AbortSignal.any([signal, AbortSignal.timeout(180000)]) : AbortSignal.timeout(180000)
  const receipts = [], requestBudget = 12 + 2 * maxNativePages
  const read = async (url, kind, closing = false) => {
    deadline.throwIfAborted()
    need(receipts.length < requestBudget, 'native request budget exhausted')
    const requestSignal = AbortSignal.any([deadline, AbortSignal.timeout(20000)])
    const requestedAt = new Date().toISOString()
    const response = await withCallerSignal(() => fetchImpl(url, { method: 'GET', redirect: 'manual', credentials: 'omit',
      signal: requestSignal, ...(closing ? { cache: 'no-store' } : {}), headers: { 'User-Agent': USER_AGENT,
        Accept: kind === 'json' ? 'application/json' : kind === 'javascript' ? 'application/javascript,text/javascript' : 'text/html,application/xhtml+xml' } }), [requestSignal])
    need(response.status === 200, 'public HTTP ' + response.status + '; zero remains unqualified')
    need(response.url === url, 'native HTTP final identity changed')
    const contentType = response.headers.get('content-type') || ''
    need((kind === 'json' ? /^application\/json\b/i : kind === 'javascript' ? /^(?:application|text)\/javascript\b/i : /^text\/html\b/i).test(contentType),
      'native HTTP content type changed')
    const byteLimit = 2 * 1024 * 1024
    need(Number(response.headers.get('content-length') || 0) <= byteLimit && response.body?.getReader, 'native response body budget unavailable')
    const reader = response.body.getReader(), chunks = []
    let size = 0, failed = false, failure
    try {
      while (true) {
        const next = await withCallerSignal(() => reader.read(), [requestSignal])
        if (next.done) break
        size += next.value.byteLength
        need(size <= byteLimit, 'native response body budget exceeded')
        chunks.push(next.value)
      }
    } catch (error) {
      failed = true
      failure = error
      throw error
    } finally {
      // A known body failure keeps priority over a later per-request timeout.
      const cleanupSignal = failed && !(requestSignal.aborted && failure === requestSignal.reason)
        ? deadline : requestSignal
      try {
        await disposeResponseReader(reader, { signal: cleanupSignal, bestEffort: failed })
      } catch (error) {
        if (signal?.aborted) throw signal.reason
        throw error
      } finally { reader.releaseLock() }
    }
    const bytes = Buffer.concat(chunks), body = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    receipts.push({ url, method: 'GET', status: 200, kind, phase: closing ? 'closing' : 'opening',
      requestedAt, completedAt: new Date().toISOString(), bodyBytes: size, bodySHA256: hash(bytes),
      bodyComplete: true, rawBodyBase64: bytes.toString('base64') })
    return kind === 'json' ? JSON.parse(body) : body
  }
  const authorities = async closing => {
    const declarations = []
    for (const url of [CORPORATE, CAREERS, SEARCH]) declarations.push(declaration(await read(url, 'html', closing), url))
    const client = declarations.at(-1).clients[0]
    need(hash(await read(client, 'javascript', closing)) === CLIENTS[client], 'current native search client renderer changed')
    return declarations
  }
  const openingAuthority = await authorities(false)
  const nativeListingRecords = [], pages = [], seen = new Set()
  let total
  for (let page = 1; page <= (total == null ? 1 : Math.ceil(total / 100)); page++) {
    const payload = await read(globalURL(page), 'json'), model = pageModel(payload, total)
    total = model.total
    need(Math.ceil(total / 100) <= maxNativePages, 'complete native inventory exceeds bounded pages; zero unavailable')
    need(model.rows.length === Math.min(100, total - (page - 1) * 100), 'native listing page count is incomplete')
    for (const row of model.rows) {
      need(!seen.has(row.identity), 'duplicate native role identity across complete listing pages')
      seen.add(row.identity); nativeListingRecords.push(row.row)
    }
    pages.push({ url: globalURL(page), snapshot: stable(payload.jobs) })
  }
  need(nativeListingRecords.length === total, 'complete native inventory count does not reconcile')
  const controlCountry = nativeListingRecords[0].data.country
  const expectedMembers = nativeListingRecords.filter(row => row.data.country === controlCountry)
  const expected = new Map(expectedMembers.map(row => [row.data.slug, controlSnapshot(row)]))
  const controlURL = new URL(API)
  controlURL.search = new URLSearchParams({ page: '1', limit: '100', country: controlCountry }).toString()
  const control = async closing => {
    const payload = await read(controlURL.href, 'json', closing)
    need(payload?.totalCount === expectedMembers.length, 'native country filter control membership/count unavailable')
    const model = pageModel(payload)
    need(model.rows.length === Math.min(100, expectedMembers.length),
      'native country filter control membership/count unavailable')
    need(new Set(model.rows.map(row => row.identity)).size === model.rows.length,
      'native country filter control repeats a role identity')
    for (const { row } of model.rows) need(row.data.country === controlCountry
      && expected.get(row.data.slug) === controlSnapshot(row), 'native country filter control disagrees with exhaustive inventory')
    return { country: controlCountry, expectedNativeCount: expectedMembers.length, reportedCount: model.total }
  }
  const empty = async closing => {
    const payload = await read(indiaURL, 'json', closing)
    need(payload && !payload.error && Array.isArray(payload.jobs) && payload.jobs.length === 0 && payload.totalCount === 0
      && (payload.count == null || payload.count === 0) && payload.filter?.displayLimit === 10,
    'configured India filter is not currently empty; ignored or changed filter cannot qualify zero')
  }
  const countryControl = await control(false)
  await empty(false)
  for (const page of pages) {
    const payload = await read(page.url, 'json', true)
    pageModel(payload, total)
    need(stable(payload.jobs) === page.snapshot, 'closing complete native inventory changed')
  }
  need(stable(await control(true)) === stable(countryControl), 'closing native country control changed')
  await empty(true)
  need(stable(await authorities(true)) === stable(openingAuthority), 'closing current corporate/careers handoff declaration changed')
  deadline.throwIfAborted()
  const verifiedAt = new Date(now()).toISOString(), jobs = []
  const audit = { source: 'firstcitizensindia', employer: EMPLOYER, verifiedAt, nativeListingRecords,
    observedListingCount: total, observedIndiaListingCount: 0, nonIndiaListingCount: total,
    exhaustiveNativeCountryInventory: true, countryControl, nativePages: pages.map(page => page.url),
    listingPaginationComplete: true, closingInventoryMatches: true, currentPublisherHandoffRechecked: true,
    currentNativeRendererRechecked: true, receipts, requestBudget, sourceScopeComplete: false,
    lifecycleCleanupAllowed: false, companyGlobalTotal: null, companyIndiaTotal: null,
    zeroScope: 'current-complete-jobs.firstcitizens.com-native-public-search-inventory',
    limitations: ['No whole-company India or global inventory claim; no lifecycle cleanup authorization.',
      'A future India role requires full own-role detail qualification before any positive output.'] }
  await withCallerSignal(() => onAudit?.(structuredClone(audit)), [deadline])
  Object.defineProperty(jobs, 'nativeCollectionEvidence', { configurable: true, value: audit })
  attachSourceObservationEvidence(jobs, { source: 'firstcitizensindia', recordKind: 'vacancy-rows',
    observedRecordCount: total, observedVacancyCount: total, sourceScopeComplete: false,
    companyGlobalTotal: null, companyIndiaTotal: null })
  return attachInventoryEvidence(jobs, { status: 'verified-empty', surface: SEARCH, firstParty: true,
    listingComplete: true, lifecycleCleanupAllowed: false, pagesFetched: receipts.length, reportedTotal: null,
    indiaFacetCount: 0, verifiedAt,
    reason: 'Every primary and additional country in the complete current native public search inventory is explicitly non-India; all pages, current corporate handoffs, reviewed renderer and native country controls rechecked unchanged. Whole-company scope and cleanup remain unqualified.' })
}
