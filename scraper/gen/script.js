import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { filterIndiaJobs } from '../../scraper-support/utils/indiaLocationFilter.js'

import GEN_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = GEN_CATALOG
export const SOURCE = GEN_CATALOG.source
export const COMPANY = GEN_CATALOG.companyName
export const OFFICIAL_JOBS_PAGE_URL = GEN_CATALOG.officialJobsPageUrl
export const ASHBY_PUBLIC_BOARD_URL = GEN_CATALOG.ashbyPublicBoardUrl
export const ASHBY_JOB_BOARD_URL = GEN_CATALOG.ashbyJobBoardUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|ul|ol|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#39;|&apos;|&#x27;|&#8217;|&rsquo;/gi, "'")
    .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeText = (value) => (normalizeWhitespace(value) || '').toLowerCase()

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return normalized.replace(/([a-z])([A-Z])/g, '$1 $2')
}

const getAddress = (location = {}) => location?.address?.postalAddress || location?.address || {}

const toLocationCandidate = (location = {}) => {
  const address = getAddress(location)
  const city = normalizeWhitespace(address?.addressLocality)
  const state = normalizeWhitespace(address?.addressRegion)
  const country = normalizeWhitespace(address?.addressCountry)
  const label = normalizeWhitespace(location?.location)

  return {
    location: label || [city, state, country].filter(Boolean).join(', '),
    city,
    state,
    country,
  }
}

const isIndiaLocationCandidate = (candidate) => filterIndiaJobs([candidate]).length > 0

const selectIndiaLocation = (job = {}) => {
  const candidates = [
    toLocationCandidate({ location: job.location, address: job.address }),
    ...(Array.isArray(job.secondaryLocations) ? job.secondaryLocations : []).map(toLocationCandidate),
  ].filter((candidate) => candidate.location)

  return candidates.find((candidate) => isIndiaLocationCandidate(candidate)) || null
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

export const hasOfficialJobsPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return normalized.includes('grow your career at gen')
    && normalized.includes('open roles')
    && /https:\/\/jobs\.ashbyhq\.com\//i.test(page)
}

export const extractVerifiedAshbyPublicBoardUrl = (html = '') => {
  const match = String(html ?? '').match(/https:\/\/jobs\.ashbyhq\.com\/gen-digital\b/i)
  return match ? match[0] : null
}

export const buildAshbyJobBoardUrl = (publicBoardUrl) => {
  const match = String(publicBoardUrl ?? '').match(/jobs\.ashbyhq\.com\/([^/?#]+)/i)
  return match ? `https://api.ashbyhq.com/posting-api/job-board/${match[1]}` : null
}

export const extractAshbyJobs = (payload = {}) =>
  (Array.isArray(payload?.jobs) ? payload.jobs : [])
    .filter((job) => job?.isListed === true)
    .map((job) => {
      const selectedLocation = selectIndiaLocation(job)
      if (!selectedLocation) return null

      return {
        title: normalizeWhitespace(job?.title),
        company: COMPANY,
        department: normalizeWhitespace(job?.department),
        location: selectedLocation.location,
        city: selectedLocation.city,
        state: selectedLocation.state,
        country: selectedLocation.country,
        jobId: normalizeWhitespace(job?.id),
        requisitionId: normalizeWhitespace(job?.id),
        sourceUrl: normalizeWhitespace(job?.jobUrl),
        applyUrl: normalizeWhitespace(job?.applyUrl),
        employmentType: normalizeEmploymentType(job?.employmentType),
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(job?.publishedAt),
        closingDate: null,
        jobDescription: String(job?.descriptionHtml ?? '').trim() || null,
      }
    })
    .filter((job) => job?.title && job.jobId && job.sourceUrl && job.applyUrl)

export const createGenScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
  } = {}) {
    const jobsPageHtml = await fetchText(OFFICIAL_JOBS_PAGE_URL)
    if (!hasOfficialJobsPageSignal(jobsPageHtml)) {
      throw new Error('The verified Gen jobs page no longer matches the trusted official first-party surface')
    }

    const publicBoardUrl = extractVerifiedAshbyPublicBoardUrl(jobsPageHtml)
    if (publicBoardUrl !== ASHBY_PUBLIC_BOARD_URL) {
      throw new Error('The verified Gen Ashby board handoff no longer matches the trusted official jobs page')
    }

    const jobBoardUrl = buildAshbyJobBoardUrl(publicBoardUrl)
    if (jobBoardUrl !== ASHBY_JOB_BOARD_URL) {
      throw new Error('The verified Gen Ashby board API URL no longer matches the trusted official jobs page')
    }

    const payload = await fetchJson(jobBoardUrl)
    if (!Array.isArray(payload?.jobs)) {
      throw new Error('The verified Gen Ashby payload no longer exposes the expected jobs array')
    }

    return extractAshbyJobs(payload).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createGenScraper(options).run(options)

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
