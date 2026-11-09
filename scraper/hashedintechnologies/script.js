import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'hashedintechnologies'
export const COMPANY = 'HashedIn Technologies'
export const HOMEPAGE_URL = 'https://www.hashedin.com/'
export const CAREERS_URL = 'https://www.hashedin.com/careers/'
export const EXPERIENCED_JOBS_URL = 'https://www.hashedin.com/data/careers/experiencedJobs.json'
export const FRESHER_JOBS_URL = 'https://www.hashedin.com/data/careers/fresherJobs.json'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&ndash;|&#8212;|&mdash;/gi, '-')
  .replace(/<[^>]+>/g, ' ')

const normalizeWhitespace = (value) => decodeHtml(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

const normalizeLocation = (value) => {
  const parts = String(value ?? '')
    .split(/[\/,]/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)

  if (parts.length === 0) return null
  if (!parts.some((part) => /^india$/i.test(part))) parts.push('India')

  return parts.join(', ')
}

const deriveCity = (location) => String(location ?? '')
  .split(',')
  .map((part) => normalizeWhitespace(part))
  .find((part) => part && !/^(india|remote|hybrid)$/i.test(part)) || null

const deriveRemoteStatus = (location) => {
  const normalized = normalizeWhitespace(location) || ''
  if (/remote/i.test(normalized)) return 'Remote'
  if (/hybrid/i.test(normalized)) return 'Hybrid'
  return 'On-site'
}

const normalizeDepartment = (value) => {
  if (/^experienced$/i.test(value)) return 'Experienced'
  if (/^fresher$/i.test(value)) return 'Fresher'
  return normalizeWhitespace(value)
}

const isAllowedApplyUrl = (value) => {
  try {
    const url = new URL(value)
    return /^apply\.hashedin\.com$/i.test(url.hostname) && /^\/caf\/?$/i.test(url.pathname)
  } catch {
    return false
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return /href=["']\/careers["']/i.test(page)
    && /(open positions|what impact will you make)/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /careers-hero-button/i.test(page)
    && /See Current Job Openings/i.test(page)
    && /explore-opportunities/i.test(page)
}

export const parseJobsFeedResponseText = (value) => {
  const raw = String(value ?? '').trim()
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      throw new Error('HashedIn Technologies jobs feed changed; refusing to scrape')
    }
    return parsed
  } catch (error) {
    if (/HashedIn Technologies jobs feed changed/i.test(String(error?.message || error))) {
      throw error
    }
    throw new Error('HashedIn Technologies jobs feed changed; refusing to scrape')
  }
}

export const extractJobsFromFeed = (feed, department) => {
  if (!Array.isArray(feed)) {
    throw new Error('HashedIn Technologies jobs feed changed; refusing to scrape')
  }

  const normalizedDepartment = normalizeDepartment(department)

  return feed.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error('HashedIn Technologies jobs feed changed; refusing to scrape')
    }

    if (entry.status && entry.status !== 'active') {
      return []
    }

    const jobId = normalizeWhitespace(entry.id)
    const title = normalizeWhitespace(entry.title)
    const experienceRequired = normalizeWhitespace(entry.experience)
    const jobDescription = normalizeWhitespace(entry.description)
    const location = normalizeLocation(entry.location)
    const applyUrl = normalizeWhitespace(entry.detailedJdUrl)
    const postingDate = normalizeWhitespace(entry.lastUpdated)

    if (
      !jobId
      || !title
      || !experienceRequired
      || !jobDescription
      || !location
      || !applyUrl
      || !isAllowedApplyUrl(applyUrl)
    ) {
      throw new Error('HashedIn Technologies jobs feed changed; refusing to scrape')
    }

    return [{
      title,
      company: COMPANY,
      department: normalizedDepartment,
      location,
      city: deriveCity(location),
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: applyUrl,
      applyUrl,
      employmentType: null,
      experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate,
      closingDate: null,
      jobDescription,
      remoteStatus: deriveRemoteStatus(location),
    }]
  })
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchFeedText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createHashedInTechnologiesScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, fetchFeedText = defaultFetchFeedText, now: overrideNow } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('HashedIn Technologies official homepage signal changed; refusing to scrape')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('HashedIn Technologies official careers surface changed; refusing to scrape')
    }

    const experiencedJobs = extractJobsFromFeed(
      parseJobsFeedResponseText(await fetchFeedText(EXPERIENCED_JOBS_URL)),
      'experienced',
    )
    const fresherJobs = extractJobsFromFeed(
      parseJobsFeedResponseText(await fetchFeedText(FRESHER_JOBS_URL)),
      'fresher',
    )

    return [...experiencedJobs, ...fresherJobs].map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: (overrideNow || now)(),
    }))
  },
})

export const run = async (options = {}) => createHashedInTechnologiesScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  console.log(`Total HashedIn Technologies India jobs scraped: ${jobs.length}`)
  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
