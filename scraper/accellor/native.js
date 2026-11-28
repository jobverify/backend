import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { toPlainText } from '../../scraper-support/detailExtractors/shared.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'
import { activeScripts } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

export const CAREERS_URL = 'https://www.accellor.com/who-we-are/careers'
export const PROXY_URL = 'https://workable-proxy-lyart.vercel.app/api/gem-jobs'
export const BOARD_URL = 'https://jobs.gem.com/accellor'
export const GRAPHQL_URL = 'https://jobs.gem.com/api/public/graphql/batch'
export const LIST_QUERY = `query JobBoardList($boardId: String!) {
  oatsExternalJobPostings(boardId: $boardId) { jobPostings { id extId title locations { id name city isoCountry isRemote extId } job { id locationType employmentType department { id name extId } } } }
  oatsExternalJobPostingsFilters(boardId: $boardId) { type displayName rawValue value count }
  jobBoardExternal(vanityUrlPath: $boardId) { id teamDisplayName descriptionHtml pageTitle }
}`
export const DETAIL_QUERY = `query ExternalJobPosting($boardId: String!, $extId: String!) {
  oatsExternalJobPosting(boardId: $boardId, extId: $extId) {
    id extId title descriptionHtml firstPublishedTsSec isApplicationFormHidden isUnlistedExternally
    locations { id extId name city isoCountry isRemote }
    job { id requisitionId teamDisplayName locationType employmentType department { id name } locations { id extId name city isoCountry isRemote } }
    jobPostSectionHtml { introHtml outroHtml }
  }
}`
const text = value => typeof value === 'string' ? value.trim() : ''
const prove = (ok, message) => {
  if (!ok) throw Object.assign(new Error('Accellor native inventory: ' + message), {
    softFailure: true, failureKind: 'upstream_inventory_unavailable', abortRetries: true,
  })
}
const request = async (url, options = {}) => {
  const response = await fetch(url, { ...options, signal: options.signal
    ? AbortSignal.any([options.signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000),
  headers: { Accept: 'application/json,text/html', 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', ...options.headers } })
  prove(response.status === 200 && response.url === url, 'HTTP response or final URL changed for ' + url)
  return response
}
const defaultFetchPage = async (url, options) => { const response = await request(url, options); return { status: response.status, finalUrl: response.url, html: await response.text() } }
const defaultFetchJson = async (url, options) => (await request(url, options)).json()
const unwrap = payload => {
  prove(Array.isArray(payload) && payload.length === 1 && payload[0]?.data && typeof payload[0].data === 'object'
    && !Array.isArray(payload[0].data) && !payload[0].error
    && (payload[0].errors == null || Array.isArray(payload[0].errors) && payload[0].errors.length === 0), 'failed GraphQL envelope')
  return payload[0].data
}
const extId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(value)
const proxyFetch = new RegExp('\\bfetch\\s*\\(\\s*(["\'])' + PROXY_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\1\\s*\\)')
const roleUrl = id => `${BOARD_URL}/${id}`
const locations = values => {
  prove(Array.isArray(values) && values.length > 0, 'missing native location inventory')
  const ids = new Set()
  return values.map(value => {
    prove(value && text(value.id) && !ids.has(value.id) && text(value.extId) && text(value.name)
      && typeof value.city === 'string' && typeof value.isRemote === 'boolean'
      && ['IND', 'USA'].includes(value.isoCountry), 'unknown or repeated native country/location identity')
    ids.add(value.id)
    prove(value.isoCountry !== 'IND' || !/\b(?:United States|USA|US Remote)\b/i.test(value.name + ' ' + value.city), 'contradictory India office')
    prove(value.isoCountry !== 'USA' || !/\bIndia\b/i.test(value.name + ' ' + value.city), 'contradictory foreign office')
    return Object.fromEntries(['id', 'extId', 'name', 'city', 'isoCountry', 'isRemote'].map(key => [key, value[key]]))
  })
}
const locationSignature = values => JSON.stringify(locations(values).sort((a, b) => a.id.localeCompare(b.id)))
const readListing = payload => {
  const data = unwrap(payload), board = data.jobBoardExternal
  prove(board && text(board.id) && board.teamDisplayName === 'Accellor' && board.pageTitle === 'Accellor Careers', 'native employer/board identity changed')
  const jobs = data.oatsExternalJobPostings?.jobPostings, filters = data.oatsExternalJobPostingsFilters
  prove(Array.isArray(jobs) && Array.isArray(filters), 'missing complete native listing')
  const departments = filters.filter(value => value.type === 'DEPARTMENT')
  const partitions = new Map(), unassignedPostingIds = []
  prove(departments.length > 0, 'native department inventory missing')
  for (const department of departments) {
    prove(text(department.rawValue) && text(department.displayName)
      && department.value === '1__' + department.rawValue
      && !partitions.has(department.rawValue) && Number.isSafeInteger(department.count) && department.count >= 0,
    'native department filter identity or count changed')
    partitions.set(department.rawValue, { name: department.displayName, reportedCount: department.count, observedCount: 0 })
  }
  const ids = new Set(), postings = new Set()
  for (const job of jobs) {
    prove(job && extId(job.extId) && text(job.id) && text(job.title) && text(job.job?.id)
      && !ids.has(job.extId) && !postings.has(job.id), 'missing or repeated native posting identity')
    ids.add(job.extId); postings.add(job.id); locations(job.locations)
    // Gem's typed department filters omit explicitly unassigned postings.
    // Missing/unknown fields are not an unassigned department. Every assigned
    // posting still belongs to one exact native filter identity and count.
    prove(Object.hasOwn(job.job, 'department'), 'native posting department field missing')
    const department = job.job.department
    if (department === null) unassignedPostingIds.push(job.extId)
    else {
      const partition = partitions.get(department?.extId)
      prove(department && text(department.id) && text(department.extId)
        && text(department.name) && partition && partition.name === department.name,
      'native posting department identity changed')
      partition.observedCount++
    }
  }
  prove([...partitions.values()].every(partition => partition.reportedCount === partition.observedCount)
    && departments.reduce((sum, department) => sum + department.count, 0) + unassignedPostingIds.length === jobs.length,
  'native count and job inventory disagree')
  // Preserve independent count disagreements as scope holds. The native city
  // filters are not rewritten or dismissed merely because proxy IDs agree.
  const locationFilterDisagreements = filters.filter(filter => filter.type === 'LOCATION_CITY').flatMap(filter => {
    prove(text(filter.rawValue) && Number.isSafeInteger(filter.count) && filter.count >= 0,
      'native location filter identity or count changed')
    const observedCount = jobs.filter(job => job.locations.some(location => location.extId === filter.rawValue)).length
    return observedCount === filter.count ? [] : [{ nativeLocationId: filter.rawValue,
      name: filter.displayName, reportedCount: filter.count, observedCount }]
  })
  return { board, jobs, payload: structuredClone(payload), departmentPartition: {
    assignedPostingCount: jobs.length - unassignedPostingIds.length, unassignedPostingIds,
    departments: [...partitions].map(([nativeDepartmentId, values]) => ({ nativeDepartmentId, ...values })),
  }, locationFilterDisagreements }
}
const signature = listing => JSON.stringify([listing.board.id, listing.jobs.map(job => ({
  id: job.id, extId: job.extId, title: job.title, job: job.job, locations: locations(job.locations),
})).sort((a, b) => a.extId.localeCompare(b.extId))])

export async function runAccellor({ fetchPage = defaultFetchPage, fetchJson = defaultFetchJson, signal, now = () => new Date().toISOString(), maxJobs = null } = {}) {
  signal?.throwIfAborted()
  prove(maxJobs === null, 'caller cap cannot certify a complete inventory')
  const official = await fetchPage(CAREERS_URL, { signal })
  signal?.throwIfAborted()
  prove(official.status === 200 && (official.finalUrl || official.url) === CAREERS_URL
    && activeScripts(official.html || '', { excludeObjectFallback: true }).some(body => proxyFetch.test(body)), 'current official proxy handoff/binding unavailable')
  const proxy = await fetchJson(PROXY_URL, { signal })
  signal?.throwIfAborted()
  prove(proxy && !proxy.error && Array.isArray(proxy.jobs), 'official proxy listing unavailable')
  const query = async (operationName, variables, query) => {
    signal?.throwIfAborted()
    const payload = await fetchJson(GRAPHQL_URL, { signal, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ operationName, variables: { boardId: 'accellor', ...variables }, query }]) })
    signal?.throwIfAborted()
    return payload
  }
  const first = readListing(await query('JobBoardList', {}, LIST_QUERY))
  prove(proxy.jobs.length === first.jobs.length && new Set(proxy.jobs.map(job => job.url)).size === first.jobs.length, 'official/native inventory count mismatch')
  for (const item of proxy.jobs) {
    const native = first.jobs.find(job => roleUrl(job.extId) === item.url)
    prove(native && native.title === item.title, 'official proxy/native tenant or posting identity mismatch')
  }
  const checkedAt = new Date(now()).toISOString(), india = first.jobs.filter(job => job.locations.some(location => location.isoCountry === 'IND')), jobs = [], nativeDetailPayloads = []
  for (const stub of india) {
    signal?.throwIfAborted()
    const detailPayload = await query('ExternalJobPosting', { extId: stub.extId }, DETAIL_QUERY)
    nativeDetailPayloads.push({ extId: stub.extId, payload: structuredClone(detailPayload) })
    const detail = unwrap(detailPayload).oatsExternalJobPosting
    prove(detail && detail.id === stub.id && detail.extId === stub.extId && detail.title === stub.title
      && detail.job?.id === stub.job.id && detail.job.teamDisplayName === 'Accellor'
      && detail.isApplicationFormHidden === false && detail.isUnlistedExternally === false, 'native role/employer/application identity mismatch')
    prove(locationSignature(detail.locations) === locationSignature(stub.locations)
      && locationSignature(detail.job.locations) === locationSignature(stub.locations), 'native detail location inventory changed')
    prove(text(detail.descriptionHtml) && hasSourceDescription({ sourceDescription: detail.descriptionHtml }), 'native full description missing')
    const sourceDescription = [detail.jobPostSectionHtml?.introHtml, detail.descriptionHtml, detail.jobPostSectionHtml?.outroHtml].filter(Boolean).join('\n')
    prove(detail.firstPublishedTsSec == null || Number.isSafeInteger(detail.firstPublishedTsSec)
      && detail.firstPublishedTsSec > 0 && detail.firstPublishedTsSec * 1000 <= Date.parse(checkedAt), 'invalid native publication date')
    const indiaLocations = [...new Set(detail.locations.filter(value => value.isoCountry === 'IND').map(value => `${text(value.city) || value.name}, India`))]
    jobs.push({ source: 'accellor', company: 'Accellor', jobId: stub.extId, requisitionId: text(detail.job.requisitionId) || null,
      title: stub.title, country: 'India', location: indiaLocations.join(' / '), locations: indiaLocations,
      city: indiaLocations.length === 1 ? indiaLocations[0].split(',')[0] : null,
      sourceUrl: roleUrl(stub.extId), applyUrl: roleUrl(stub.extId), link: roleUrl(stub.extId),
      department: text(detail.job.department?.name) || null, employmentType: detail.job.employmentType,
      sourceDescription, jobDescription: toPlainText(sourceDescription), sourceDetailComplete: true,
      postingDate: detail.firstPublishedTsSec == null ? null : new Date(detail.firstPublishedTsSec * 1000).toISOString(), scrapedAt: checkedAt })
  }
  const last = readListing(await query('JobBoardList', {}, LIST_QUERY))
  prove(signature(first) === signature(last), 'final native listing drift')
  signal?.throwIfAborted()
  const complete = first.locationFilterDisagreements.length === 0 && last.locationFilterDisagreements.length === 0
  for (const job of jobs) Object.assign(job, { sourceListingComplete: complete,
    sourceScopeComplete: complete, lifecycleCleanupAllowed: complete })
  const observations = { source: 'accellor', recordKind: 'vacancy-rows', observedRecordCount: last.jobs.length,
    observedVacancyCount: last.jobs.length, sourceScopeComplete: complete, companyGlobalTotal: null, companyIndiaTotal: null }
  attachSourceObservationEvidence(jobs, observations)
  Object.defineProperty(jobs, 'nativeCollectionEvidence', { configurable: true, value: {
    ...observations, openingNativePayload: first.payload, closingNativePayload: last.payload,
    nativeDetailPayloads, employerProxyPayload: structuredClone(proxy),
    openingDepartmentPartition: first.departmentPartition, closingDepartmentPartition: last.departmentPartition,
    openingLocationFilterDisagreements: first.locationFilterDisagreements,
    closingLocationFilterDisagreements: last.locationFilterDisagreements,
    nativePostingProjectionClosingReconciled: true,
    nativePostingClosingProjectionFields: ['board.id', 'id', 'extId', 'title', 'job', 'locations'],
    lifecycleCleanupAllowed: complete,
    companyScopeComplete: complete, applicationInteractions: 0,
  } })
  return attachInventoryEvidence(jobs, { status: complete ? first.jobs.length ? 'complete-inventory' : 'verified-empty' : 'coverage-gap', firstParty: true,
    surface: BOARD_URL, listingComplete: complete, lifecycleCleanupAllowed: complete, pagesFetched: 2,
    reportedTotal: first.jobs.length, indiaFacetCount: complete ? india.length : null,
    verifiedAt: checkedAt, reason: 'current-official-proxy-bound-gem-native-department-partition-and-final-inventory-reconciled'
      + (complete ? '' : ';native-location-filter-counts-unreconciled;company-scope-unknown;cleanup-forbidden') })
}
