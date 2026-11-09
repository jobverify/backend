import { createDeclaredJobFeedScraper, DECLARED_JOB_FEED_PROFILES } from '../../scraper-support/native-sources/declaredJobFeeds/nativeCareers.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { filterIndiaJobs } from '../../scraper-support/utils/indiaLocationFilter.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { extractAshbyExperienceRequired } from '../../scraper-support/utils/ashbyExperience.js'

import { REDPANDA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = REDPANDA_CATALOG.source
export const COMPANY = REDPANDA_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = REDPANDA_CATALOG.officialBrandName
export const VERIFIED_ON = REDPANDA_CATALOG.verifiedOn
export const PROVIDER_METADATA = REDPANDA_CATALOG
export const JOBS_PAGE_URL = REDPANDA_CATALOG.companyCareerPage
export const ASHBY_BOARD_SLUG = REDPANDA_CATALOG.ashbyBoardSlug
export const ASHBY_JOB_BOARD_URL = REDPANDA_CATALOG.ashbyJobBoardUrl

const normalizeString = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;|&#038;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#8217;|&#x27;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeString(value)
  if (!normalized) return null
  return normalized.replace(/([a-z])([A-Z])/g, '$1 $2')
}

const getAddress = (location = {}) => location?.address?.postalAddress || location?.address || {}

const toLocationCandidate = (location = {}) => {
  const address = getAddress(location)
  const label = normalizeString(location?.location)
  const city = normalizeString(address?.addressLocality)
  const state = normalizeString(address?.addressRegion)
  const country = normalizeString(address?.addressCountry)

  return {
    location: label || [city, state, country].filter(Boolean).join(', '),
    city,
    state,
    country,
  }
}

const hasExplicitIndiaSignal = (candidate = {}) => {
  const location = normalizeString(candidate.location) || ''
  const country = normalizeString(candidate.country) || ''
  const city = normalizeString(candidate.city) || ''
  const state = normalizeString(candidate.state) || ''

  return /india/i.test([location, country, city, state].join(' '))
}

const selectIndiaLocation = (job = {}) => {
  const candidates = [
    toLocationCandidate({ location: job.location, address: job.address }),
    ...(Array.isArray(job.secondaryLocations) ? job.secondaryLocations : []).map(toLocationCandidate),
  ].filter((candidate) => candidate.location)

  return filterIndiaJobs(candidates).find(hasExplicitIndiaSignal) || null
}

const inferRemoteStatus = (job = {}) => {
  if (job?.isRemote === true || /remote/i.test(String(job?.workplaceType ?? ''))) return 'Remote'
  if (/hybrid/i.test(String(job?.workplaceType ?? ''))) return 'Hybrid'
  if (job?.workplaceType) return 'On-site'
  return null
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasVerifiedJobsPageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeString(rawHtml) || ''
  const hasCanonical = /<link[^>]+href=["']https:\/\/www\.redpanda\.com\/jobs["'][^>]+rel=["']canonical["']/i.test(rawHtml)
    || /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.redpanda\.com\/jobs["']/i.test(rawHtml)

  return /<title>\s*Jobs at Redpanda \| Real-Time Data (?:&amp;|&) Enterprise AI\s*<\/title>/i.test(rawHtml)
    && hasCanonical
    && /join our mission/i.test(normalized)
    && /current job openings/i.test(normalized)
    && /recruitment scams alert/i.test(normalized)
    && /https:\/\/api\.ashbyhq\.com\/posting-api\/job-board\/'\s*\+\s*encodeURIComponent\(ASHBY_BOARD\)/i.test(rawHtml)
}

export const extractVerifiedAshbyBoardSlug = (html = '') => {
  const match = String(html ?? '').match(/var\s+ASHBY_BOARD\s*=\s*['"]([a-z0-9-]+)['"]/i)
  return match?.[1] || null
}

export const buildAshbyJobBoardUrl = (boardSlug) =>
  /^[a-z0-9-]+$/i.test(String(boardSlug ?? ''))
    ? `https://api.ashbyhq.com/posting-api/job-board/${String(boardSlug).toLowerCase()}`
    : null

export const extractAshbyJobs = (payload = {}) =>
  (Array.isArray(payload?.jobs) ? payload.jobs : [])
    .filter((job) => job?.isListed === true)
    .map((job) => {
      const title = normalizeString(job?.title)
      const jobId = normalizeString(job?.id)
      const sourceUrl = normalizeString(job?.jobUrl)
      const applyUrl = normalizeString(job?.applyUrl)
      const selectedLocation = selectIndiaLocation(job)

      if (!title || !jobId || !sourceUrl || !applyUrl || !selectedLocation) return null

      return {
        title,
        company: COMPANY,
        department: normalizeString(job?.department),
        location: selectedLocation.location,
        city: selectedLocation.city,
        state: selectedLocation.state,
        country: selectedLocation.country,
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl,
        employmentType: normalizeEmploymentType(job?.employmentType),
        experienceRequired: extractAshbyExperienceRequired({
          title,
          jobDescription: normalizeString(job?.descriptionPlain ?? job?.descriptionHtml),
        }),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeString(job?.publishedAt),
        closingDate: null,
        jobDescription: normalizeString(job?.descriptionPlain ?? job?.descriptionHtml),
        remoteStatus: inferRemoteStatus(job),
      }
    })
    .filter(Boolean)

export const createRedpandaScraper = (options = {}) => createDeclaredJobFeedScraper(DECLARED_JOB_FEED_PROFILES.redpanda, options)

export const run = async (options = {}) => createRedpandaScraper(options).run(options)

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
