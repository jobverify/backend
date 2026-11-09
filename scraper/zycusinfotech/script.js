import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import ZYCUS_INFOTECH_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = ZYCUS_INFOTECH_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const COMPANY_CONFIG_URL = PROVIDER_METADATA.companyConfigUrl

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const INDIA_LOCATION_PATTERN =
  /\b(india|mumbai|pune|bangalore|bengaluru|gurugram|gurgaon|noida|hyderabad|chennai|delhi)\b/i

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

export const hasOfficialZycusCareersSignals = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page) || ''

  return /<title[^>]*>\s*Zycus Careers/i.test(page)
    && text.includes('Select your location for suitable openings')
    && text.includes('SEARCH ALL JOBS')
    && /https:\/\/zycus\.talismatic\.com\/jobs/i.test(page)
}

export const buildJobsRequestBody = ({ pageSize = 200 } = {}) => ({
  company: 'zycus',
  page_size: pageSize,
  status: 'OPEN',
})

const isIndiaLocation = (value) => INDIA_LOCATION_PATTERN.test(String(value ?? ''))

const buildJobUrl = (job = {}) => {
  const directUrl = normalizeWhitespace(job.jobUrl)
  if (directUrl) return directUrl
  const identifier = normalizeWhitespace(job.id || job.jobId || job.jobCode)
  return identifier ? `https://zycus.talismatic.com/jobs/${identifier}` : null
}

export const extractJobs = (payload = {}) => {
  const jobs = Array.isArray(payload.jobs) ? payload.jobs : []

  return jobs
    .filter((job) => isIndiaLocation(job.location))
    .map((job) => {
      const sourceUrl = buildJobUrl(job)
      return {
        title: normalizeWhitespace(job.jobTitle),
        company: COMPANY,
        department: normalizeWhitespace(job.department),
        location: normalizeWhitespace(job.location),
        city: normalizeWhitespace(job.location),
        country: 'India',
        jobId: normalizeWhitespace(job.id || job.jobCode),
        requisitionId: normalizeWhitespace(job.jobCode),
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: normalizeWhitespace(job.employmentType),
        experienceRequired: normalizeWhitespace(job.experience),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(job.dateCreated)?.slice(0, 10) || null,
        closingDate: null,
        jobDescription: normalizeWhitespace(job.description),
      }
    })
    .filter((job) => job.title && job.jobId && job.sourceUrl)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  method: options.method || 'GET',
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  },
  body: options.body,
  label: `${SOURCE}-json`,
  timeoutMs: 45000,
})

export const createZycusInfotechScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialZycusCareersSignals(careersHtml)) {
      throw new Error('Zycus verified first-party careers page no longer matches the Talismatic handoff')
    }

    await fetchJson(COMPANY_CONFIG_URL)

    const payload = await fetchJson(JOBS_API_URL, {
      method: 'POST',
      body: JSON.stringify(buildJobsRequestBody()),
    })
    const jobs = extractJobs(payload)

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createZycusInfotechScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
