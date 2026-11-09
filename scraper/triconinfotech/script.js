import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { CANONICAL_CITIES } from '../../scraper-support/utils/cities.js'
import { toPlainText } from '../../scraper-support/detailExtractors/shared.js'
import TRICON_INFOTECH_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const PROVIDER_METADATA = TRICON_INFOTECH_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const ARCHIVE_URL = 'https://www.triconinfotech.com/jobs/'
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
const PAGE_SIZE = 100
const USER_AGENT = 'JobverifyCareerScraper/1.0'
const normalize = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const decode = value => String(value ?? '').replace(/&(#x[\da-f]+|#\d+|amp|nbsp|quot|apos|lt|gt|ndash|mdash|rsquo|lsquo|ldquo|rdquo|hellip);/gi, (entity, key) => {
  if (key.startsWith('#')) return String.fromCodePoint(key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1)))
  return ({ amp: '&', nbsp: ' ', quot: '"', apos: "'", lt: '<', gt: '>', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…' })[key.toLowerCase()]
})
const text = value => toPlainText(decode(String(value ?? '').replace(/<!--[\s\S]*?-->/g, '')))
const key = value => normalize(text(value)).replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
const attr = (tag, name) => decode(tag.match(new RegExp('\\b' + name + '=["\\\']([^"\\\']*)["\\\']', 'i'))?.[1] || '')
const fail = message => { throw new Error('Tricon Infotech incomplete public inventory: ' + message) }
const pageUrl = page => { const url = new URL(JOBS_API_URL); url.searchParams.set('page', String(page)); return url.toString() }
const jobLinks = html => [...String(html).matchAll(/<a\b[^>]*>/gi)]
  .map(match => new URL(attr(match[0], 'href'), ARCHIVE_URL).toString())
  .filter(url => /^https:\/\/www\.triconinfotech\.com\/jobs\/[a-z0-9-]+\/$/.test(url))
const brandTitle = html => /<title>[^<]*Tricon Infotech[^<]*<\/title>/i.test(html)
export const hasVerifiedAwsmShellSignal = (html = '') => /awsm_job_openings/i.test(html) && /awsmJobsPublic/i.test(html)
export const hasPublicJobsSurfaceSignal = (html = '', payload = []) => jobLinks(html).length > 0
  || /<[^>]+class=["'][^"']*\bawsm-b-job-post-title\b[^"']*["'][^>]*>/i.test(html)
  || (Array.isArray(payload) && payload.length > 0)

const requestOptions = (signal, accept) => ({
  headers: { 'User-Agent': USER_AGENT, Accept: accept }, signal, timeoutMs: 15000, label: SOURCE,
  fetchImpl: async (url, options) => {
    const response = await fetch(url, options)
    if (response.ok && response.url !== url) fail('unexpected public route redirect: ' + url)
    return response
  },
})
const defaultFetchText = (url, signal) => fetchTextWithRetry(url, requestOptions(signal, 'text/html'))
const defaultFetchFeed = async (url, signal) => {
  let headers
  const options = requestOptions(signal, 'application/json'), fetchImpl = options.fetchImpl
  options.fetchImpl = async (target, init) => {
    const response = await fetchImpl(target, init)
    headers = response.headers
    return response
  }
  const items = await fetchJsonWithRetry(url, options)
  const integerHeader = name => {
    const value = headers?.get(name)
    if (!/^\d+$/.test(value ?? '')) fail('missing WordPress count header: ' + name)
    return Number(value)
  }
  return { items, total: integerHeader('x-wp-total'), totalPages: integerHeader('x-wp-totalpages') }
}
const validateRow = row => {
  if (!Number.isSafeInteger(row?.id) || row.id <= 0 || row.status !== 'publish' || row.type !== 'awsm_job_openings'
    || !/^https:\/\/www\.triconinfotech\.com\/jobs\/[a-z0-9-]+\/$/.test(row.link ?? '')
    || !key(row.title?.rendered) || !text(row.content?.rendered) || row.content.protected !== false
    || !Array.isArray(row.class_list) || !row.class_list.includes('post-' + row.id)
    || !row.class_list.includes('status-publish') || !row.class_list.some(value => /^job-location-.+/.test(value))
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(row.date_gmt ?? '')
    || !Number.isFinite(Date.parse(row.date_gmt + 'Z'))) fail('missing, unpublished or malformed job row')
  return row
}
const getInventory = async fetchFeed => {
  const first = await fetchFeed(JOBS_API_URL)
  const { total, totalPages } = first ?? {}
  if (!Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(totalPages)
    || totalPages !== Math.ceil(total / PAGE_SIZE) || totalPages > 100) fail('invalid WordPress pagination totals')
  const items = [], ids = new Set(), links = new Set()
  for (let page = 1; page <= Math.max(1, totalPages); page++) {
    const payload = page === 1 ? first : await fetchFeed(pageUrl(page))
    const expected = Math.min(PAGE_SIZE, Math.max(0, total - (page - 1) * PAGE_SIZE))
    if (payload?.total !== total || payload?.totalPages !== totalPages || !Array.isArray(payload.items)
      || payload.items.length !== expected) fail('truncated page or changing pagination count')
    for (const item of payload.items) {
      validateRow(item)
      if (ids.has(item.id) || links.has(item.link)) fail('repeated job identity across pages')
      ids.add(item.id); links.add(item.link); items.push(item)
    }
  }
  return { items, total, pages: Math.max(1, totalPages) }
}
const countryFor = (location, explicitCountry) => {
  const city = normalize(location).toLowerCase()
  const isIndiaCity = Boolean(CANONICAL_CITIES[city]) && !/^(remote|none)$/.test(city)
  const foreignCity = /^(portland|cupertino|reading|london|singapore|dubai|new york|san francisco)$/.test(city)
  if (explicitCountry) {
    const country = normalize(typeof explicitCountry === 'object' ? explicitCountry.name : explicitCountry)
    const india = /^(in|india)$/i.test(country)
    const validCountry = india || /^(united states(?: of america)?|usa|united kingdom|uk|singapore|united arab emirates)$/i.test(country)
      || (/^[A-Z]{2}$/.test(country) && new Intl.DisplayNames(['en'], { type: 'region' }).of(country) !== country)
    if (!validCountry || (india && foreignCity) || (!india && isIndiaCity)) fail('contradictory or unknown job country')
    return india ? 'India' : 'foreign'
  }
  if (isIndiaCity || city === 'india') return 'India'
  if (foreignCity || /^(united states|usa|united kingdom|uk|singapore|united arab emirates)$/.test(city)) return 'foreign'
  fail('unresolved public job location country: ' + location)
}
const mapDetail = (row, html) => {
  const postings = [...String(html).matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap(match => { const data = JSON.parse(match[1]); return Array.isArray(data) ? data : [data, ...(data['@graph'] || [])] })
    .filter(data => data['@type'] === 'JobPosting')
  const forms = [...String(html).matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/gi)]
    .filter(match => attr(match[0].split('>')[0], 'id') === 'awsm-application-form')
  const job = postings[0], title = key(row.title.rendered)
  const hiddenIds = forms.flatMap(form => [...form[0].matchAll(/<input\b[^>]*>/gi)]
    .filter(match => attr(match[0], 'name') === 'awsm_job_id').map(match => attr(match[0], 'value')))
  if (!brandTitle(html) || postings.length !== 1 || job?.hiringOrganization?.name !== COMPANY
    || !/^https:\/\/www\.triconinfotech\.com\/?$/.test(job?.hiringOrganization?.sameAs ?? '')
    || !new RegExp('\\bpostid-' + row.id + '\\b').test(html)
    || key(job.title) !== title || key(String(html).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]) !== title
    || key(job.description) !== key(row.content.rendered)
    || Date.parse(job.datePosted) !== Date.parse(row.date_gmt + 'Z')
    || forms.length !== 1 || attr(forms[0][0].split('>')[0], 'method').toLowerCase() !== 'post'
    || hiddenIds.length !== 1 || hiddenIds[0] !== String(row.id)) fail('job detail or application identity disagrees with listing')
  const action = attr(forms[0][0].split('>')[0], 'action')
  if (action && new URL(action, row.link).toString() !== row.link) fail('unverified job application target')
  const locations = (Array.isArray(job.jobLocation) ? job.jobLocation : [job.jobLocation]).map(place => {
    const address = place?.address
    const location = normalize(typeof address === 'string' ? address : address?.addressLocality)
    if (!location) fail('missing job-specific location')
    const slug = location.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (!row.class_list.includes('job-location-' + slug)) fail('location taxonomy and public detail disagree')
    return { location, country: countryFor(location, address?.addressCountry) }
  })
  const locationTerms = [...String(html).matchAll(/<div\b[^>]*class=["'][^"']*\bawsm-job-specification-job-location\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi)]
    .flatMap(match => [...match[1].matchAll(/<span\b[^>]*class=["'][^"']*\bawsm-job-specification-term\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)].map(term => key(term[1])))
  const taxonomyCount = row.class_list.filter(value => /^job-location-/.test(value)).length
  if (!locations.length || taxonomyCount !== locations.length || new Set(locations.map(value => value.location)).size !== locations.length
    || locationTerms.length !== locations.length || locations.some(value => !locationTerms.includes(value.location))) fail('incomplete or contradictory job-specific locations')
  const closingDate = job.validThrough ? new Date(job.validThrough).toISOString() : null
  return {
    title, company: COMPANY, jobId: String(row.id), requisitionId: String(row.id), sourceUrl: row.link, applyUrl: row.link,
    location: locations.map(value => value.location).join(' / '), locations,
    city: CANONICAL_CITIES[locations.find(value => value.country === 'India')?.location.toLowerCase()] || null,
    state: null, country: locations.some(value => value.country === 'India') ? 'India' : null,
    jobDescription: text(row.content.rendered), postingDate: new Date(row.date_gmt + 'Z').toISOString(), closingDate,
    employmentType: job.employmentType || null, remoteStatus: row.class_list.includes('job-type-hybrid') ? 'Hybrid' : null,
    experienceRequired: text(row.content.rendered).match(/\b\d+(?:\s*[-–]\s*\d+|\+)?\s*(?:years?|yrs?)\b/i)?.[0] || null,
    publicExperienceChecked: true, minimumQualification: null, preferredQualification: null, requiredSkills: [],
  }
}
const fingerprint = inventory => JSON.stringify([...inventory.items].sort((a, b) => a.id - b.id))

export const run = async ({ fetchText, fetchFeed, signal, now = () => new Date().toISOString() } = {}) => {
  fetchText ??= url => defaultFetchText(url, signal)
  fetchFeed ??= url => defaultFetchFeed(url, signal)
  const careersHtml = await fetchText(CAREERS_URL)
  if (!brandTitle(careersHtml) || ![...String(careersHtml).matchAll(/<a\b[^>]*>/gi)]
    .some(match => new URL(attr(match[0], 'href'), CAREERS_URL).toString() === ARCHIVE_URL)) fail('official careers jobs handoff changed')
  const archiveHtml = await fetchText(ARCHIVE_URL)
  if (!brandTitle(archiveHtml) || !hasVerifiedAwsmShellSignal(archiveHtml)) fail('official AWSM jobs archive changed')
  const first = await getInventory(fetchFeed)
  const links = new Set(jobLinks(archiveHtml))
  if ((first.total > 0 && !links.size) || [...links].some(link => !first.items.some(item => item.link === link))) fail('jobs archive and REST inventory disagree')
  const all = []
  for (const row of first.items) all.push(mapDetail(row, await fetchText(row.link)))
  const last = await getInventory(fetchFeed)
  if (last.total !== first.total || fingerprint(last) !== fingerprint(first)) fail('published inventory changed during detail validation')
  const verifiedAt = now()
  const jobs = all.filter(job => job.country === 'India' && (!job.closingDate || job.closingDate > verifiedAt))
    .map(({ locations, ...job }) => job)
  return attachInventoryEvidence(jobs, {
    status: first.total === 0 ? 'verified-empty' : 'complete-inventory',
    surface: JOBS_API_URL, firstParty: true, listingComplete: true,
    pagesFetched: first.pages + last.pages + first.total + 2, reportedTotal: first.total, indiaFacetCount: jobs.length,
    verifiedAt, reason: 'Official careers handoff, complete WordPress count/paging, every published detail/application and stable inventory reconciled before India filtering.',
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
