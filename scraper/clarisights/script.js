import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { toPlainText } from '../../scraper-support/detailExtractors/shared.js'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const CAREERS_PAGE_URL = 'https://clarisights.com/careers'
export const TEAMTAILOR_JOBS_API_URL = 'https://api.teamtailor.com/v1/jobs'
export const TEAMTAILOR_BOARD_URL = 'https://clarisights.teamtailor.com'
const WIDGET_SCRIPT_URL = 'https://scripts.teamtailor-cdn.com/widgets/eu-pink/jobs.js'
const USER_AGENT = 'JobverifyCareerScraper/1.0'
const normalizeString = value => value == null ? null : String(value).trim() || null
const decodeWidgetHtml = html => String(html ?? '').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')

const extractWidgetKey = html => {
  const keys = [...new Set(Array.from(decodeWidgetHtml(html).matchAll(/data-teamtailor-api-key=["']([a-z0-9_-]+)["']/gi)).map(match => match[1]))]
  return keys.length === 1 ? keys[0] : null
}
export const hasOfficialCareersSignal = html => {
  const page = decodeWidgetHtml(html)
  return /Clarisights/i.test(page)
    && /<link\b(?=[^>]*\brel=["']canonical["'])(?=[^>]*\bhref=["']https:\/\/clarisights\.com\/careers["'])[^>]*>/i.test(page)
    && page.includes(WIDGET_SCRIPT_URL)
    && Boolean(extractWidgetKey(page))
}

const buildApiUrl = (value, key) => {
  const url = new URL(value)
  if (url.origin + url.pathname !== TEAMTAILOR_JOBS_API_URL) throw new Error('Clarisights untrusted Teamtailor pagination URL')
  // These are the public widget's own parameters; its key is read from the official careers page.
  url.searchParams.set('api_key', key)
  url.searchParams.set('api_version', '20161108')
  url.searchParams.set('include', 'department,locations')
  url.searchParams.set('filter[feed]', 'public')
  url.searchParams.set('page[size]', '30')
  if (!url.searchParams.has('page[number]')) url.searchParams.set('page[number]', '1')
  return url.toString()
}
const defaultFetchText = url => fetchTextWithRetry(url, { headers: { 'User-Agent': USER_AGENT }, label: 'clarisights', timeoutMs: 15000 })
const defaultFetchJson = url => fetchJsonWithRetry(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/vnd.api+json' }, label: 'clarisights', timeoutMs: 15000 })
const isTrustedJobUrl = value => {
  try {
    const url = new URL(value)
    return url.origin === TEAMTAILOR_BOARD_URL && /^\/jobs\/[^/]+(?:\/applications\/new)?$/.test(url.pathname)
  } catch { return false }
}

const mapIndiaJobs = (items, included) => items.flatMap(item => {
  const attributes = item?.attributes
  if (item?.type !== 'jobs' || !normalizeString(item?.id) || !normalizeString(attributes?.title)) throw new Error('Clarisights malformed Teamtailor job fields')
  if (attributes['human-status'] !== 'published' || attributes.status !== 'open' || attributes.internal === true) return []
  const references = item.relationships?.locations?.data
  if (!Array.isArray(references) || references.length === 0) throw new Error('Clarisights missing Teamtailor location metadata')
  const locations = references.map(reference => {
    const location = included.get(`locations:${reference.id}`)?.attributes
    if (!location || !normalizeString(location.country)) throw new Error('Clarisights missing Teamtailor location metadata')
    return location
  })
  const location = locations.find(value => /^(India|IN)$/i.test(value.country))
  if (!location) return []
  const sourceUrl = normalizeString(item.links?.['careersite-job-url'])
  const applyUrl = normalizeString(item.links?.['careersite-job-apply-url'])
  if (!isTrustedJobUrl(sourceUrl) || !isTrustedJobUrl(applyUrl)) throw new Error('Job links no longer belong to the verified Clarisights Teamtailor board')
  const city = normalizeString(location.city || location.name)
  if (!city) throw new Error('Clarisights missing Teamtailor location metadata')
  const title = normalizeString(attributes.title)
  const jobDescription = toPlainText(attributes.body || '') || null
  const departmentId = item.relationships?.department?.data?.id
  return [{
    title, company: 'Clarisights', department: normalizeString(included.get(`departments:${departmentId}`)?.attributes?.name),
    location: `${city}, India`, city, state: null, country: 'India',
    jobId: String(item.id), requisitionId: String(item.id), sourceUrl, applyUrl,
    employmentType: normalizeString(attributes['employment-type']),
    experienceRequired: extractJobFilterSignals({ title, jobDescription, experienceRequired: null }).experienceProfile?.evidence || null,
    minimumQualification: null, preferredQualification: null, requiredSkills: [],
    postingDate: normalizeString(attributes['start-date']), closingDate: normalizeString(attributes['end-date']), jobDescription,
    remoteStatus: ({ hybrid: 'Hybrid', fully: 'Remote', onsite: 'On-site', none: 'On-site' })[attributes['remote-status']] || null,
  }]
})

export const createClarisightsScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson } = {}) {
    const careersHtml = await fetchText(CAREERS_PAGE_URL)
    if (!hasOfficialCareersSignal(careersHtml)) throw new Error('Clarisights careers page no longer exposes the verified Teamtailor widget')
    const key = extractWidgetKey(careersHtml)
    const items = [], included = new Map(), seenPages = new Set(), seenIds = new Set()
    let url = buildApiUrl(TEAMTAILOR_JOBS_API_URL, key)
    let reportedTotal, pageCount
    while (url) {
      if (seenPages.has(url)) throw new Error('Clarisights incomplete Teamtailor inventory: repeated pagination URL')
      seenPages.add(url)
      const payload = await fetchJson(url)
      const total = payload?.meta?.['record-count'], pages = payload?.meta?.['page-count']
      if (!Array.isArray(payload?.data) || !Number.isInteger(total) || total < 0 || !Number.isInteger(pages) || pages < 0) throw new Error('Clarisights malformed Teamtailor inventory')
      reportedTotal ??= total
      pageCount ??= pages
      if (total !== reportedTotal || pages !== pageCount) throw new Error('Clarisights incomplete Teamtailor inventory: totals changed during pagination')
      for (const item of payload.data) {
        if (!normalizeString(item?.id) || seenIds.has(String(item.id))) throw new Error('Clarisights incomplete Teamtailor inventory: missing or repeated job ID')
        seenIds.add(String(item.id))
        items.push(item)
      }
      for (const resource of payload.included || []) included.set(`${resource.type}:${resource.id}`, resource)
      if (items.length > reportedTotal || seenPages.size > Math.max(1, pageCount)) throw new Error('Clarisights incomplete Teamtailor inventory: count exceeded')
      url = payload.links?.next ? buildApiUrl(payload.links.next, key) : null
    }
    if (items.length !== reportedTotal || seenPages.size !== Math.max(1, pageCount)) throw new Error('Clarisights incomplete Teamtailor inventory: advertised counts were not reached')
    const jobs = mapIndiaJobs(items, included).map(job => ({ ...job, source: 'clarisights', link: job.applyUrl, scrapedAt: now() }))
    return attachInventoryEvidence(jobs, {
      status: reportedTotal === 0 ? 'verified-empty' : 'complete-inventory', surface: TEAMTAILOR_JOBS_API_URL,
      firstParty: true, listingComplete: true, pagesFetched: seenPages.size, reportedTotal, indiaFacetCount: jobs.length,
      verifiedAt: now(), reason: 'complete-teamtailor-public-inventory',
    })
  },
})
export const run = async (options = {}) => createClarisightsScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, 'clarisights')
}
