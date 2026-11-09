import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchJsonWithRetry, composeAbortSignals } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { mapWithConcurrency } from '../../scraper-support/utils/mapWithConcurrency.js'
import { CANONICAL_CITIES } from '../../scraper-support/utils/cities.js'
import { toPlainText } from '../../scraper-support/detailExtractors/shared.js'
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
const BOARD_SCRIPT_URL = 'https://netcoreai.mynexthire.com/employer/ui/js/jobboard/careers.js'
const PRESENTATION_URL = 'https://careerpagenetcore.lovable.app/'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0.0.0 Safari/537.36'
const normalize = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const plain = html => toPlainText(html).replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#0?39;|&apos;/gi, "'")
const same = (a, b) => normalize(a).toLowerCase() === normalize(b).toLowerCase()
const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/javascript,*/*' },
    signal: composeAbortSignals(signal, AbortSignal.timeout(15000)),
  })
  return { status: response.status, url: response.url, html: await response.text() }
}
const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  ...options, headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...options.headers },
  timeoutMs: 15000, label: SOURCE,
})
const getPage = async (fetchPage, url, signal) => {
  const page = await fetchPage(url, { signal })
  if (page.status !== 200 || page.url !== url) throw new Error('Netcore verified public careers surface unavailable: HTTP ' + page.status + ' for ' + url)
  return page.html
}
const postOptions = (body, signal) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal })
const verifyTenant = tenant => {
  if (tenant?.clientId !== 1127 || tenant.clientName !== 'Netcore AI' || tenant.companyWebsite !== 'https://netcore.ai/') throw new Error('Netcore public ATS tenant identity changed materially')
  const urls = tenant.tenantPreferencesMap?.career_page_url?.url
  if (!Array.isArray(urls) || urls.length !== 3 || new Set(urls.map(item => item.pageType)).size !== 3
    || !['application', 'jd', 'list'].every(type => urls.some(item => item.pageType === type && item.url === 'https://netcorecloud.com/careers-list'))) throw new Error('Netcore public ATS careers handoff changed materially')
}
const verifyPresentation = html => {
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
const verifyFullListContract = script => {
  if (!/reqList\s*=\s*response\.data\.reqDetailsBOList/.test(script)
    || !/pagination\.totalItems\s*=\s*[^;]+reqList\.length\s*;/.test(script)
    || !/url:\s*careersFactory\.smaclifyUrl\s*\+\s*["']\/careers\/reqlist\/get["']/.test(script)) throw new Error('Netcore complete public inventory contract changed materially')
}
const locationKey = locations => JSON.stringify(locations.map(item => [normalize(item.office).toLowerCase(), normalize(item.address).toLowerCase()]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))
const validateLocations = locations => {
  if (!Array.isArray(locations) || !locations.length || locations.some(item => !normalize(item?.office) || typeof item.address !== 'string')) throw new Error('Netcore incomplete inventory: unresolved job locations')
}
const countryFor = row => {
  const offices = row.locationList.map(item => normalize(item.office))
  const inferred = offices.map(office => CANONICAL_CITIES[office.toLowerCase()] && !/^(remote|none)$/i.test(office) ? 'India'
    : /\b(?:Philippines|Manila|Singapore|Indonesia|Jakarta|Vietnam|Malaysia|Thailand|United States|USA|United Kingdom|London|Australia|UAE|Dubai)\b/i.test(office) ? 'foreign' : null)
  if (normalize(row.countryCode)) {
    const code = normalize(row.countryCode).toUpperCase()
    const countryName = /^[A-Z]{2}$/.test(code) ? new Intl.DisplayNames(['en'], { type: 'region' }).of(code) : null
    if (!countryName || countryName === code || code === 'ZZ') throw new Error('Netcore incomplete inventory: unknown job country code')
    const country = code === 'IN' ? 'India' : 'foreign'
    if (inferred.some(value => value && value !== country)) throw new Error('Netcore incomplete inventory: contradictory job country')
    return country
  }
  if (inferred.some(value => !value) || new Set(inferred).size !== 1) throw new Error('Netcore incomplete inventory: unknown or mixed job country')
  return inferred[0]
}
const validateInventory = payload => {
  if (!Array.isArray(payload?.reqDetailsBOList) || payload.errorMessage
    || ['next', 'nextPage', 'pageToken', 'hasMore', 'offset', 'limit', 'totalPages'].some(key => payload[key] != null)) throw new Error('Netcore incomplete public inventory: invalid jobs array or unsupported pagination')
  const seen = new Set()
  for (const row of payload.reqDetailsBOList) {
    if (!Number.isInteger(row?.reqId) || row.reqId <= 0 || !normalize(row.reqTitle) || !normalize(row.location) || !normalize(row.jdDisplay)
      || row.statusId !== 3 || !Number.isFinite(row.expMin) || !Number.isFinite(row.expMax) || row.expMin < 0 || row.expMax < row.expMin) throw new Error('Netcore incomplete public inventory: invalid job fields or approved status')
    if (seen.has(row.reqId)) throw new Error('Netcore incomplete public inventory: duplicate job ID')
    seen.add(row.reqId)
    validateLocations(row.locationList)
    if (!row.locationList.some(item => same(row.location, item.office)) && !same(row.location, row.locationList.map(item => item.office).join(', '))) throw new Error('Netcore incomplete public inventory: listing locations disagree')
    countryFor(row)
    if (!/^\d{4}-\d{2}-\d{2}T/.test(row.approvedOn || '')) throw new Error('Netcore incomplete public inventory: posting date missing')
  }
  return payload.reqDetailsBOList
}
const inventoryKey = rows => JSON.stringify(rows.map(row => [
  row.reqId, row.statusId, normalize(row.reqTitle), normalize(row.location), locationKey(row.locationList), normalize(row.countryCode),
  row.expMin, row.expMax, normalize(row.buName), row.approvedOn, normalize(row.employmentType), normalize(row.jdDisplay),
]).sort((a, b) => a[0] - b[0]))
const buildJobUrl = (id, pageType = 'jd') => {
  const context = { pageType, cvSource: 'careers', reqId: id, requester: { id: '', code: '', name: '' }, page: 'careers', bufilter: -1, customFields: {} }
  const url = new URL(CAREERS_URL)
  url.searchParams.set('src', 'careers')
  url.searchParams.set('p', Buffer.from(JSON.stringify(context)).toString('base64'))
  return url.toString()
}
const mapDetail = (row, payload) => {
  const detail = payload?.data?.reqDetailsBO
  if (payload?.status !== 200 || !detail || detail.reqId !== row.reqId || detail.statusId !== 3 || detail.requisitionPublished !== true
    || !same(detail.reqTitle, row.reqTitle) || detail.expMin !== row.expMin || detail.expMax !== row.expMax || !normalize(detail.jdDisplay)
    || !Array.isArray(detail.locationList) || !detail.locationList.length
    || detail.locationList.some(item => !normalize(item?.office) || typeof item.address !== 'string')
    || locationKey(detail.locationList) !== locationKey(row.locationList)) throw new Error('Netcore published job detail no longer matches its current public listing')
  const sourceUrl = buildJobUrl(row.reqId)
  return {
    title: normalize(detail.reqTitle), company: COMPANY, source: SOURCE, jobId: String(row.reqId), requisitionId: String(row.reqId),
    location: normalize(row.location), city: normalize(row.location), country: countryFor(row) === 'India' ? 'India' : null,
    department: normalize(row.buName) || null, sourceUrl, applyUrl: buildJobUrl(row.reqId, 'application'), postingDate: row.approvedOn.slice(0, 10),
    employmentType: normalize(row.employmentType) || null, experienceRequired: row.expMin + '-' + row.expMax + ' years',
    publicExperienceChecked: true, jobDescription: plain(detail.jdDisplay), requiredSkills: [],
    minimumQualification: null, preferredQualification: null, closingDate: null, remoteStatus: null,
  }
}

export const createNetcoreCloudScraper = () => ({
  async run({ fetchPage = defaultFetchPage, fetchJson = defaultFetchJson, signal, now = () => new Date().toISOString() } = {}) {
    signal?.throwIfAborted()
    // The current first-party site delegates to this presentation; the public tenant independently pins its company and careers URL.
    verifyPresentation(await getPage(fetchPage, PRESENTATION_URL, signal))
    verifyBoard(await getPage(fetchPage, CAREERS_URL, signal))
    verifyTenant(await fetchJson(TENANT_API_URL, { signal }))
    verifyFullListContract(await getPage(fetchPage, BOARD_SCRIPT_URL, signal))
    const listBody = { source: 'careers', code: '', filterByBuId: -1 }
    const rows = validateInventory(await fetchJson(LISTING_API_URL, postOptions(listBody, signal)))
    const details = await mapWithConcurrency(rows, 3, async row => {
      signal?.throwIfAborted()
      return mapDetail(row, await fetchJson(DETAIL_API_URL, postOptions({ source: 'careers', id: '', code: '', reqId: row.reqId }, signal)))
    })
    const finalRows = validateInventory(await fetchJson(LISTING_API_URL, postOptions(listBody, signal)))
    if (inventoryKey(rows) !== inventoryKey(finalRows) || details.length !== rows.length) throw new Error('Netcore public inventory changed during detail validation: count and record agreement failed')
    signal?.throwIfAborted()
    const jobs = details.filter(job => job.country === 'India').map(job => ({ ...job, location: /\bIndia\b/i.test(job.location) ? job.location : job.location + ', India', link: job.applyUrl, scrapedAt: now() }))
    return attachInventoryEvidence(jobs, {
      status: jobs.length ? 'complete-inventory' : 'verified-empty', surface: CAREERS_URL, firstParty: true, listingComplete: true,
      pagesFetched: 2, reportedTotal: null, indiaFacetCount: jobs.length, verifiedAt: now(),
      reason: 'complete-public-array-' + rows.length + '-published-job-details-reconciled-stable-count-india-' + jobs.length,
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
