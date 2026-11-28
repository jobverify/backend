import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchJsonWithRetry, composeAbortSignals } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { requireNativeHttpResponse } from '../../scraper-support/shared/nativeHttpResponse.js'
import { toPlainText } from '../../scraper-support/detailExtractors/shared.js'
import { PRESENTATION_URL, verifyCurrentPresentation, verifyNativeReadPrograms } from './currentPresentation20261128.js'
import { NETCORE_CLOUD_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const PROVIDER_METADATA = NETCORE_CLOUD_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const CAREERS_LIST_URL = PROVIDER_METADATA.companyCareersListUrl
export const COMPANY_DOMAIN = PROVIDER_METADATA.companyDomain
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const LISTING_API_URL = 'https://netcoreai.mynexthire.com/employer/careers/reqlist/get'
export const TENANT_API_URL = 'https://netcoreai.mynexthire.com/employer/jobboard/details_by_shortname/get/netcoreai/'
export const DETAIL_API_URL = 'https://netcoreai.prod.us1.mynexthire.io/d17/careers/requisition/object'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0.0.0 Safari/537.36'
const MAX_BODY_BYTES = 4 * 1024 * 1024
const normalize = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const plain = html => toPlainText(html).replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#0?39;|&apos;/gi, "'")
const same = (a, b) => normalize(a).toLowerCase() === normalize(b).toLowerCase()
const defaultFetchPage = async (url, { signal } = {}) => {
  signal?.throwIfAborted()
  const deadline = composeAbortSignals(signal, AbortSignal.timeout(15000))
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/javascript,*/*' },
    redirect: 'error', credentials: 'omit',
    signal: deadline,
  })
  signal?.throwIfAborted()
  await requireNativeHttpResponse(response, url, { context: 'Netcore public careers page HTTP', signal: deadline, callerSignal: signal ?? null })
  signal?.throwIfAborted()
  const html = await response.text()
  signal?.throwIfAborted()
  return { status: response.status, url: response.url, headers: Object.fromEntries(response.headers), html }
}
const defaultFetchJson = async (url, options = {}) => {
  const response = await fetchJsonWithRetry(url, {
    ...options, redirect: 'error', credentials: 'omit', includeResponseMetadata: true,
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...options.headers },
    timeoutMs: 15000, label: SOURCE,
  })
  options.signal?.throwIfAborted()
  if (response.status !== 200 || response.url !== url) throw new Error('Netcore public native JSON response identity unavailable')
  return response.payload
}
const getPage = async (fetchPage, url, signal) => {
  signal?.throwIfAborted()
  let page
  try { page = await fetchPage(url, { signal }) } catch (error) { signal?.throwIfAborted(); throw error }
  signal?.throwIfAborted()
  await requireNativeHttpResponse({ status: page.status, url: page.url, headers: new Headers(page.headers), body: null, bodyUsed: true }, url,
    { context: 'Netcore verified public careers surface unavailable', signal, callerSignal: signal ?? null })
  signal?.throwIfAborted()
  if (typeof page.html !== 'string' || Buffer.byteLength(page.html) > MAX_BODY_BYTES) throw new Error('Netcore complete public client/program response exceeds byte contract')
  return page.html
}
const postOptions = (body, signal) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal })
const verifyTenant = tenant => {
  if (tenant?.clientId !== 1127 || tenant.clientName !== 'Netcore AI' || tenant.companyWebsite !== 'https://netcore.ai/') throw new Error('Netcore public ATS tenant identity changed materially')
  const urls = tenant.tenantPreferencesMap?.career_page_url?.url
  if (!Array.isArray(urls) || urls.length !== 3 || new Set(urls.map(item => item.pageType)).size !== 3
    || !['application', 'jd', 'list'].every(type => urls.some(item => item.pageType === type && item.url === 'https://netcorecloud.com/careers-list'))) throw new Error('Netcore public ATS careers handoff changed materially')
}
const verifyLegacyPresentation = html => {
  const categories = [...String(html).matchAll(/href=["']https:\/\/netcorecloud\.com\/careers-list\?job_category=([a-z_]+)["']/g)].map(match => match[1]).sort()
  if (!/<title>\s*Careers at Netcore\b[^<]*<\/title>/i.test(html) || !/Find Your Role/i.test(normalize(plain(html)))
    || JSON.stringify([...new Set(categories)]) !== JSON.stringify(['customer_success', 'engineering', 'marketing', 'others', 'product', 'sales'])) throw new Error('Netcore verified careers presentation handoff changed materially')
}
const verifyBoard = html => {
  if (!/<title>\s*Approved Jobs, powered by Smaclify Technologies!\s*<\/title>/i.test(html)
    || !/\bng-app=["']careersApp["']/.test(html) || !/\bng-controller=["']careersController["']/.test(html)
    || !String(html).includes('/employer/ui/html/jobboard/careers/careers-application.html')
    || !/<script\b[^>]*src=["']\/employer\/ui\/js\/jobboard\/careers\.js["']/i.test(html)) throw new Error('Netcore verified public careers board handoff unavailable')
}
const canonical = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
const locationKey = locations => canonical(locations)
const validateLocations = locations => {
  if (!Array.isArray(locations) || !locations.length || locations.some(item => !normalize(item?.office) || typeof item.address !== 'string')) throw new Error('Netcore incomplete inventory: unresolved job locations')
}
const validateInventory = payload => {
  if (!payload || canonical(Object.keys(payload).sort()) !== canonical(['hrXmlModel', 'reqDetailsBOList', 'requesterTitle'])
    || !Array.isArray(payload.reqDetailsBOList) || payload.reqDetailsBOList.length > 2000) throw new Error('Netcore incomplete public inventory: invalid jobs array or unsupported pagination/envelope')
  const seen = new Set()
  for (const row of payload.reqDetailsBOList) {
    if (!Number.isInteger(row?.reqId) || row.reqId <= 0 || !normalize(row.reqTitle) || !normalize(row.location) || !normalize(row.jdDisplay)
      || row.statusId !== 3 || !Number.isFinite(row.expMin) || !Number.isFinite(row.expMax) || row.expMin < 0 || row.expMax < row.expMin) throw new Error('Netcore incomplete public inventory: invalid job fields or approved status')
    if (seen.has(row.reqId)) throw new Error('Netcore incomplete public inventory: duplicate job ID')
    seen.add(row.reqId)
    validateLocations(row.locationList)
    if (!row.locationList.some(item => same(row.location, item.office)) && !same(row.location, row.locationList.map(item => item.office).join(', '))) throw new Error('Netcore incomplete public inventory: listing locations disagree')
    // approvedOn is retained as native workflow data, never promoted to a
    // publication date. Country cannot be inferred from an office or address.
  }
  return payload.reqDetailsBOList
}
const observeDetail = (row, payload, reasons) => {
  const detail = payload?.data?.reqDetailsBO
  if (payload?.status !== 200 || !detail || detail.reqId !== row.reqId || detail.statusId !== 3 || detail.requisitionPublished !== true
    || !same(detail.reqTitle, row.reqTitle) || detail.expMin !== row.expMin || detail.expMax !== row.expMax || !normalize(detail.jdDisplay)
    || !Array.isArray(detail.locationList) || !detail.locationList.length
    || detail.locationList.some(item => !normalize(item?.office) || typeof item.address !== 'string')
    || locationKey(detail.locationList) !== locationKey(row.locationList)) throw new Error('Netcore published job detail no longer matches its current public listing')
  const countries = [row.country, row.countryCode, detail.country, detail.countryCode,
    ...row.locationList.flatMap(place => [place.country, place.countryCode]),
    ...detail.locationList.flatMap(place => [place.country, place.countryCode])].filter(value => value != null && value !== '')
  const countryNames = countries.map(value => ['India', 'IN', 'IND'].includes(value) ? 'IN' : value)
  reasons.add(!countries.length ? 'native-role-country-unpublished:' + row.reqId
    : countryNames.some(value => typeof value !== 'string') || new Set(countryNames).size > 1 ? 'native-role-country-conflicts:' + row.reqId
      : 'native-role-country-unqualified:' + row.reqId)
  return {
    source: SOURCE, jobId: String(row.reqId), title: detail.reqTitle,
    listingRecord: row, detailResponse: payload, detailRecord: detail,
    sourceUrl: CAREERS_URL, nativeListingUrl: LISTING_API_URL, nativeDetailUrl: DETAIL_API_URL,
    jobDescription: detail.jdDisplay, sourceDescription: detail.jdDisplay,
    country: null, city: null, location: null, remoteStatus: null, postingDate: null, applyUrl: null,
    sourceDetailComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
  }
}

export const createNetcoreCloudScraper = () => ({
  async run({ fetchPage = defaultFetchPage, fetchJson = defaultFetchJson, signal, now = () => new Date().toISOString(), onRecords, onAudit } = {}) {
    signal?.throwIfAborted()
    const pageAt = url => getPage(fetchPage, url, signal)
    const jsonAt = async (url, options = { signal }) => {
      signal?.throwIfAborted()
      let payload
      try { payload = await fetchJson(url, options) } catch (error) { signal?.throwIfAborted(); throw error }
      signal?.throwIfAborted()
      if (Buffer.byteLength(JSON.stringify(payload) ?? '') > MAX_BODY_BYTES) throw new Error('Netcore public native JSON response exceeds byte contract')
      return payload
    }
    const presentation = await pageAt(PRESENTATION_URL)
    let presentationProfile
    // Choose the current profile before validating it; a current-client failure
    // must never fall through to the historical identity-only presentation.
    if (presentation.includes('https://netcore.ai/careers-list?job_category=') || presentation.includes('/assets/index-q-Djt2Ye.js')) {
      presentationProfile = await verifyCurrentPresentation(presentation, pageAt)
    } else { verifyLegacyPresentation(presentation); presentationProfile = 'legacy-identity-only' }
    const board = await pageAt(CAREERS_URL)
    verifyBoard(board)
    const tenant = await jsonAt(TENANT_API_URL)
    verifyTenant(tenant)
    await verifyNativeReadPrograms(board, CAREERS_URL, pageAt)
    const listBody = { source: 'careers', code: '', filterByBuId: -1 }
    const openingInventory = await jsonAt(LISTING_API_URL, postOptions(listBody, signal))
    const rows = validateInventory(openingInventory)
    const reasons = new Set(['corporate-current-delegation-unverified', 'role-employer-scope-unqualified',
      'full-native-criterion-rendering-unqualified', 'native-application-authority-unqualified',
      'native-publication-date-unqualified', 'company-scope-unqualified'])
    const observations = []
    for (const row of rows) {
      signal?.throwIfAborted()
      observations.push(observeDetail(row, await jsonAt(DETAIL_API_URL, postOptions({ source: 'careers', id: '', code: '', reqId: row.reqId }, signal)), reasons))
    }
    const closingInventory = await jsonAt(LISTING_API_URL, postOptions(listBody, signal))
    validateInventory(closingInventory)
    if (canonical(openingInventory) !== canonical(closingInventory)) throw new Error('Netcore public inventory changed during detail validation: full raw count and record agreement failed')
    const closingTenant = await jsonAt(TENANT_API_URL)
    verifyTenant(closingTenant)
    if (canonical(tenant) !== canonical(closingTenant)) throw new Error('Netcore closing native tenant identity/configuration changed')
    signal?.throwIfAborted()
    // Raw observations are retained outside the job-normalization boundary.
    // Unknown geography cannot acquire India defaults or create a company zero.
    const jobs = []
    attachSourceObservationEvidence(jobs, { source: SOURCE, recordKind: 'vacancy-rows', observedRecordCount: rows.length,
      observedVacancyCount: rows.length, sourceScopeComplete: false })
    const audit = { source: SOURCE, recordKind: 'vacancy-rows', observedRecordCount: rows.length, observedVacancyCount: rows.length,
      sourceScopeComplete: false, lifecycleCleanupAllowed: false, companyIndiaTotal: null, companyGlobalTotal: null,
      inventoryComplete: false, detailComplete: false, applicationAuthority: false, criterionRenderingQualified: false,
      presentationProfile, observations, openingInventory, closingInventory, tenantRecord: tenant, closingTenantRecord: closingTenant,
      closingDetailReadsPerformed: false, reasons: [...reasons] }
    Object.defineProperty(jobs, 'nativeCollectionEvidence', { value: audit, configurable: true })
    if (typeof onRecords === 'function') await onRecords(structuredClone(observations))
    if (typeof onAudit === 'function') await onAudit(structuredClone(audit))
    signal?.throwIfAborted()
    return attachInventoryEvidence(jobs, {
      status: 'discovery-only', surface: CAREERS_URL, firstParty: true, listingComplete: false, lifecycleCleanupAllowed: false,
      pagesFetched: 2, reportedTotal: null, indiaFacetCount: null, verifiedAt: now(),
      reason: 'netcore-native-observations-held:' + [...reasons].join(';'),
    })
  },
})
export const run = async (options = {}) => createNetcoreCloudScraper().run(options)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
