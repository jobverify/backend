import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)
export const CAREERS_URL = 'https://www.careers.zoom.us/'
export const SITE_MAPPING_API_URL = 'https://shazamme.io/Job-Listing/src/php/regional/actions'
const DUDA_SITE_ID = '22d89a44'
const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)' }
const defaultFetchText = (url, options = {}) => fetchTextWithRetry(url, {
  ...options, headers: { ...headers, Accept: 'text/html' }, label: 'zoom', timeoutMs: 20000,
})
const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  ...options, headers: { ...headers, Accept: 'application/json', 'Content-Type': 'application/json' },
  label: 'zoom', timeoutMs: 30000,
})
const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number.parseInt(n, 10)))
  .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
const normalizeWhitespace = (value) => decodeHtmlEntities(value).replace(/\s+/g, ' ').trim()
const stripHtml = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]*>/g, ' '))
const toDate = (value) => {
  if (!value) return null
  const timestamp = Date.parse(/Z$|[+-]\d\d:\d\d$/.test(value) ? value : value + 'Z')
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null
}

export const extractSearchResults = (payload, siteId) => {
  if (!Array.isArray(payload)) throw new Error('Zoom public jobs inventory is not an array')
  const jobs = new Map()
  for (const wrapper of payload) {
    const row = wrapper?.data
    if (!row || !normalizeWhitespace(row.jobID) || !normalizeWhitespace(row.jobName)
      || !normalizeWhitespace(row.country) || row.siteID !== siteId
      || row.dudaSiteID !== DUDA_SITE_ID || typeof row.activeStatus !== 'boolean'
      || row.advertiserName !== 'Zoom' || row.siteName !== 'Zoom Careers') {
      throw new Error('Zoom public jobs inventory contains an incomplete or foreign-site employer identity record')
    }
    let url
    try { url = new URL(row.jobURL) } catch { throw new Error('Zoom public jobs inventory has a malformed detail URL') }
    if (url.protocol !== 'https:' || !['careers.zoom.com', 'www.careers.zoom.us', 'careers.zoom.us'].includes(url.hostname)
      || !/^\/job-details\/[^/]+$/.test(url.pathname)) {
      throw new Error('Zoom public jobs inventory has an unverified detail handoff')
    }
    if (!row.activeStatus || row.country !== 'India') continue
    const location = normalizeWhitespace(row.fullAddress)
    const city = normalizeWhitespace(row.city).replace(/\s*\(IND\)$/i, '')
    if (!location || !/\bIndia\b/.test(location) || !city) {
      throw new Error('Zoom public jobs inventory has incomplete India location data')
    }
    // The published widget builds detail links from the current careers origin
    // and the feed's pathname, including its current bare careers.zoom.us alias.
    const sourceUrl = new URL(url.pathname, CAREERS_URL).toString()
    const job = {
      title: normalizeWhitespace(row.jobName), company: 'Zoom',
      department: normalizeWhitespace(row.category) || null,
      location, city, country: 'India',
      jobId: row.jobID, requisitionId: normalizeWhitespace(row.referenceNumber) || row.jobID,
      sourceUrl, applyUrl: new URL('/job-application?jobID=' + encodeURIComponent(row.jobID), CAREERS_URL).toString(),
      employmentType: normalizeWhitespace(row.workType || row.jobType) || null,
      experienceRequired: null, minimumQualification: null, preferredQualification: null, requiredSkills: [],
      postingDate: toDate(row.addedOnUTC), closingDate: toDate(row.expiryDate),
      jobDescription: stripHtml(row.fullDescription) || null,
      remoteStatus: /^Remote\b/i.test(city) ? 'Remote' : normalizeWhitespace(row.workModel) || null,
    }
    const previous = jobs.get(job.jobId)
    if (previous && JSON.stringify(previous) !== JSON.stringify(job)) {
      throw new Error('Zoom public jobs inventory has conflicting duplicate IDs')
    }
    jobs.set(job.jobId, job)
  }
  return [...jobs.values()]
}

export const createZoomScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ signal, fetchText = defaultFetchText, fetchJson = defaultFetchJson } = {}) {
    const request = async (fetcher, url, init = {}) => {
      signal?.throwIfAborted()
      const result = await fetcher(url, { ...init, signal })
      signal?.throwIfAborted()
      return result
    }
    if (maxJobs != null && (!Number.isInteger(maxJobs) || maxJobs <= 0)) throw new Error('Zoom maxJobs must be positive')
    const html = await request(fetchText, CAREERS_URL)
    if (!/<title[^>]*>\s*Zoom Careers\b/i.test(html) || !/SiteAlias:\s*['"]22d89a44['"]/.test(html)
      || !String(html).includes('/job-results') || !String(html).includes('sdk.shazamme.io')) {
      throw new Error('Zoom official careers page no longer matches its verified public jobs site')
    }
    const mapping = await request(fetchJson, SITE_MAPPING_API_URL, {
      method: 'POST', body: JSON.stringify({ action: 'Get Site ID', dudaSiteID: DUDA_SITE_ID }),
    })
    const sites = mapping?.response?.items
    if (mapping?.status !== true || !Array.isArray(sites) || sites.length !== 1
      || sites[0]?.dudaSiteID !== DUDA_SITE_ID || sites[0]?.isLive !== true
      || sites[0]?.businessName !== 'Zoom Careers' || !/^[0-9a-f-]{36}$/i.test(sites[0]?.siteID || '')) {
      throw new Error('Zoom public site mapping is malformed or no longer identifies Zoom Careers')
    }
    const payload = await request(fetchJson, 'https://shazamme.io/job-results/' + sites[0].siteID)
    const allJobs = extractSearchResults(payload, sites[0].siteID)
    const jobs = maxJobs ? allJobs.slice(0, maxJobs) : allJobs
    const verified = []
    for (const job of jobs) {
      const detail = await request(fetchText, job.sourceUrl)
      const linked = [...String(detail).matchAll(/href=["']([^"']+)["']/gi)].some((match) => {
        try { return new URL(decodeHtmlEntities(match[1]), CAREERS_URL).toString() === job.applyUrl }
        catch { return false }
      })
      if (!linked || !String(detail).includes('JobPosting')) {
        throw new Error('Zoom job detail no longer exposes the verified application handoff: ' + job.sourceUrl)
      }
      verified.push({
        ...job, source: 'zoom', link: job.applyUrl, scrapedAt: now(),
        companyCareerPage: CAREERS_URL, companyDomain: 'zoom.com', atsPlatform: 'shazamme',
        ...(jobs.length < allJobs.length ? { sourceListingComplete: false } : {}),
      })
    }
    return verified
  },
})

export const run = async (options = {}) => createZoomScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, 'zoom')
}
