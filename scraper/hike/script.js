import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'hike'
export const COMPANY = 'Hike'
export const CAREERS_URL = 'https://careers.hikeapp.com/jobs'

const USER_AGENT = 'JobverifyCareerScraper/1.0'

const decodeHtml = (value = '') => String(value)
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")

const normalizeWhitespace = (value = '') => decodeHtml(value)
  .replace(/<br\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const createTimeoutSignal = (timeoutMs) => Number.isFinite(timeoutMs) && timeoutMs > 0
  ? AbortSignal.timeout(timeoutMs)
  : undefined

export const defaultFetchPage = async (url, {
  fetchImpl = fetch,
  timeoutMs = 15000,
} = {}) => {
  const response = await fetchImpl(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: createTimeoutSignal(timeoutMs),
  })

  return { status: response.status, url: response.url, html: await response.text() }
}

export const hasOfficialCareersSignal = (html = '') => {
  const raw = String(html)
  const text = normalizeWhitespace(raw)
  return /<title>\s*Open roles — Hike Careers\s*<\/title>/i.test(raw)
    && text.includes('Hike is building a family of apps')
    && /class=["']public-job-card["']/i.test(raw)
}

export const extractJobCards = (html = '') => {
  const raw = String(html)
  const pattern = /<div\b[^>]*class=["']title["'][^>]*>\s*<a\b[^>]*href=["'](\/jobs\/(JOB-[A-Z0-9]+))["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<div\b[^>]*class=["']meta["'][^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>\s*<span[^>]*class=["']meta-dot["'][^>]*><\/span>\s*<span[^>]*>([\s\S]*?)<\/span>/gi

  return [...raw.matchAll(pattern)].map((match) => ({
    title: normalizeWhitespace(match[3]),
    department: normalizeWhitespace(match[4]) || null,
    country: normalizeWhitespace(match[5]) || null,
    requisitionId: match[2],
    sourceUrl: new URL(match[1], CAREERS_URL).toString(),
  }))
}

const extractJobDetail = (html, listing) => {
  const raw = String(html ?? '')
  const detail = normalizeWhitespace(raw.match(/<div\b[^>]*class=["']jd["'][^>]*>([\s\S]*?)<\/div>/i)?.[1])
  const locationEvidence = detail.match(/\bLocation:\s*(.+?)\s+Experience:/i)?.[1]?.trim() || null
  const experienceRequired = detail.match(/\bExperience:\s*(.+?)(?:\s+About\b|\s+Build\b|$)/i)?.[1]?.trim() || null
  const remoteStatus = /\bon\s*-?site\b/i.test(locationEvidence || '')
    ? 'On-site'
    : /\bremote\b|\bwork from home\b/i.test(locationEvidence || '') ? 'Remote' : null
  const location = locationEvidence?.replace(/\s*\((?:on\s*-?site|remote|hybrid)\)\s*$/i, '').trim() || listing.country
  const city = location && location !== listing.country ? location.split(',')[0].trim() || null : null

  return { detail, location, city, remoteStatus, experienceRequired }
}

export const createHikeScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Hike official careers page no longer matches the verified first-party surface')
    }

    const listings = extractJobCards(careersPage.html)
    if (listings.length === 0) throw new Error('Hike official careers page yielded no job cards')

    return Promise.all(listings.map(async (listing) => {
      const page = await fetchPage(listing.sourceUrl)
      if (page.status !== 200 || !new RegExp(`<title>\\s*${listing.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} — Hike Careers\\s*<\\/title>`, 'i').test(page.html)) {
        throw new Error(`Hike job detail no longer matches the verified role: ${listing.requisitionId}`)
      }
      const detail = extractJobDetail(page.html, listing)
      return {
        title: listing.title,
        company: COMPANY,
        department: listing.department,
        location: detail.location,
        city: detail.city,
        state: null,
        country: listing.country,
        jobId: `${SOURCE}-${listing.requisitionId}`,
        requisitionId: listing.requisitionId,
        sourceUrl: listing.sourceUrl,
        applyUrl: `${listing.sourceUrl}/apply`,
        link: `${listing.sourceUrl}/apply`,
        employmentType: null,
        workplaceType: detail.remoteStatus,
        remoteStatus: detail.remoteStatus,
        experienceRequired: detail.experienceRequired,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        compensation: null,
        postingDate: null,
        closingDate: null,
        jobDescription: detail.detail,
        companyCareerPage: CAREERS_URL,
        companyDomain: 'hikeapp.com',
        atsPlatform: 'official-company-careers',
        source: SOURCE,
        scrapedAt: now(),
      }
    }))
  },
})

export const run = async (options = {}) => createHikeScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()
  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
