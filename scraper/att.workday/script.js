import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {INDIA_URL, CLIENT_URL, CORE_URL, inspectAttSearch, inspectAttClients, attListingUrl, parseAttPage, parseAttDetail} from './nativeContract.js'
import {getAttNative} from './nativeHttp.js'

export const SOURCE = 'att'
export const COMPANY = 'AT&T'
export const CAREERS_URL = INDIA_URL
const need = (condition, message) => { if (!condition) throw Error('AT&T native: ' + message) }

export async function run(options = {}) {
  const now = new Date(options.now ?? Date.now())
  need(Number.isFinite(+now), 'Invalid observation clock')
  const timeoutMs = options.timeoutMs ?? 20000
  const sourceTimeoutMs = options.sourceTimeoutMs ?? 180000
  need(Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 20000 && Number.isSafeInteger(sourceTimeoutMs) && sourceTimeoutMs > 0 && sourceTimeoutMs <= 300000, 'Invalid bounded source/request timeout')
  const cap = (value, label) => {
    need(value === undefined || Number.isSafeInteger(value) && value >= 1, 'Invalid ' + label + ' cap')
    return value ?? Infinity
  }
  const maxJobs = cap(options.maxJobs, 'job')
  const maxPages = cap(options.maxPages, 'page')
  const controller = new AbortController()
  const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal
  const timer = setTimeout(() => controller.abort(Error('AT&T native: Source deadline exceeded')), sourceTimeoutMs)
  const abort = () => { if (signal.aborted) throw signal.reason ?? Error('AT&T native: Source aborted') }
  async function get(url) {
    abort()
    if (!options.fetch) return (await getAttNative(url, {timeoutMs, signal, requestImpl: options.requestImpl})).body
    // Replay replaces only the external HTTP boundary. Identity, pagination,
    // full descriptions, original dates and final reconciliation remain real.
    const requestController = new AbortController()
    const requestSignal = AbortSignal.any([signal, requestController.signal])
    const timeout = setTimeout(() => requestController.abort(Error('AT&T native: Request timeout')), timeoutMs)
    let listener
    const operation = Promise.resolve().then(async () => {
      const response = await options.fetch(url, {method: 'GET', redirect: 'manual', signal: requestSignal, headers: {Accept: 'text/html,application/javascript,application/json', 'User-Agent': 'Mozilla/5.0'}})
      abort()
      need(response?.status === 200 && response.url === url, 'Native HTTP status/redirect unavailable')
      const body = await response.text()
      abort()
      need(typeof body === 'string' && body.trim() && Buffer.byteLength(body) <= 2097152, 'Native HTTP body missing or oversized')
      return body
    })
    try {
      return await Promise.race([operation, new Promise((_, reject) => {
        listener = () => reject(requestSignal.reason ?? Error('AT&T native: Request aborted'))
        requestSignal.addEventListener('abort', listener, {once: true})
        if (requestSignal.aborted) listener()
      })])
    } finally {
      clearTimeout(timeout)
      if (listener) requestSignal.removeEventListener('abort', listener)
    }
  }
  try {
    const first = inspectAttSearch(await get(INDIA_URL))
    need(first.total <= maxJobs && first.pages <= maxPages, 'Requested cap/limit would truncate the native country inventory')
    inspectAttClients(await get(CLIENT_URL), await get(CORE_URL))
    const snapshots = [{url: INDIA_URL, ...first}]
    const rows = [...first.rows]
    for (let page = 2; page <= first.pages; page++) {
      const url = attListingUrl(page, first.total)
      const parsed = parseAttPage(await get(url), {page, total: first.total})
      snapshots.push({url, ...parsed})
      rows.push(...parsed.rows)
    }
    need(rows.length === first.total && new Set(rows.map(row => row.id)).size === rows.length, 'Native all-page count/ID reconciliation failed')
    const jobs = [], unavailableRoles = []
    for (const row of rows) {
      const body = await get(row.url)
      try { jobs.push(parseAttDetail(body, row, {now: now.toISOString()})) }
      catch (failure) {
        if (failure.code !== 'ATT_NATIVE_ROLE_UNAVAILABLE' || failure.nativeJobId !== row.id) throw failure
        unavailableRoles.push({id: row.id, reason: failure.unavailableReason})
      }
    }
    need(new Set(jobs.map(job => job.jobId)).size === jobs.length, 'Native duplicate cross-page requisitions')
    for (const snapshot of snapshots) {
      const body = await get(snapshot.url)
      const final = snapshot.page === 1 ? inspectAttSearch(body) : parseAttPage(body, {page: snapshot.page, total: first.total})
      need(final.total === first.total && JSON.stringify(final.rows) === JSON.stringify(snapshot.rows), 'Native closing inventory identity/count drift')
    }
    abort()
    const declaredBoardComplete = unavailableRoles.length === 0
    for (const job of jobs) {
      job.sourceObservedIndiaJobCount = rows.length
      job.sourceGlobalJobCount = null
      job.sourceNativeFacet = 'India country 1269750'
      job.sourceDeclaredBoardScopeComplete = declaredBoardComplete
      job.sourceListingComplete = declaredBoardComplete
      job.lifecycleCleanupAllowed = false
    }
    if (jobs.length) jobs[0].nativeCollectionEvidence = { source: SOURCE,
      observedListingCount: rows.length, observedIndiaListingCount: rows.length, nonIndiaListingCount: 0,
      candidateDetails: rows.length, extractedDetailJobs: jobs.length, jobs: jobs.map(job => ({id: job.jobId})), exclusions: [],
      failures: unavailableRoles.map(role => ({stage: 'native-detail', nativeJobId: role.id, reason: role.reason})),
      listingPaginationComplete: true, closingInventoryMatches: true, sourceScopeComplete: false,
      declaredBoardScopeComplete: declaredBoardComplete }
    return attachInventoryEvidence(jobs, {
      status: declaredBoardComplete ? 'complete-inventory' : 'coverage-gap', surface: INDIA_URL, firstParty: true,
      listingComplete: declaredBoardComplete, pagesFetched: first.pages * 2,
      reportedTotal: first.total, indiaFacetCount: unavailableRoles.length ? null : first.total, verifiedAt: now.toISOString(),
      reason: 'current-declared-India-country-board; native-all-pages-and-closing-total-identities-and-listing-models-reconciled; all-returned-role-country-identity-and-full-criteria-qualified; company-wide-scope-and-native-expiry-remain-unproven; original-native-publication-and-raw-expiry-retained'
        + (unavailableRoles.length ? '; unqualified-native-details:' + unavailableRoles.map(role => role.id + ':' + role.reason).join(',') : ''),
    })
  } catch (failure) {
    if (!controller.signal.aborted) controller.abort(failure)
    throw failure
  } finally { clearTimeout(timer) }
}
