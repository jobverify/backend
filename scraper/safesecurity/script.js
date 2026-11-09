import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { isJobInPublicLocationScope } from '../../src/utils/publicJobLocationScope.js'

export const CAREER_PAGE_URL = 'https://jobs.safe.security/'
export const LEVER_ENDPOINT = 'https://api.lever.co/v0/postings/safe?mode=json'

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; JobverifyBot/1.0)',
  Accept: 'application/json',
}

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value).replace(/\s+/g, ' ').trim()
  return normalized || null
}

const extractCity = (location) => normalizeWhitespace(location)?.split(/\s+-\s+|,/)[0] || null

const isIndiaJob = (job) => {
  const location = normalizeWhitespace(job?.categories?.location)
  const city = extractCity(location)
  const locations = Array.isArray(job?.categories?.allLocations)
    ? job.categories.allLocations.map(normalizeWhitespace).filter(Boolean)
    : []

  return isJobInPublicLocationScope({
    country: 'India',
    location,
    city,
    locations,
  })
}

const toRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (normalized === 'remote') return 'Remote'
  if (normalized === 'hybrid') return 'Hybrid'
  if (normalized === 'onsite' || normalized === 'on-site') return 'On-site'
  return null
}

const toIsoDateTime = (value) => {
  if (!Number.isFinite(value)) return null

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export const extractSafeSecurityJobs = (leverJobs = []) => leverJobs
  .filter(isIndiaJob)
  .map((job) => {
    const location = normalizeWhitespace(job?.categories?.location)
    const sourceUrl = normalizeWhitespace(job?.hostedUrl)
    const id = normalizeWhitespace(job?.id)

    if (!id || !job?.text || !location || !sourceUrl) return null

    return {
      title: normalizeWhitespace(job.text),
      company: 'Safe Security',
      department: normalizeWhitespace(job?.categories?.team || job?.categories?.department),
      location,
      city: extractCity(location),
      country: 'India',
      jobId: id,
      requisitionId: id,
      sourceUrl,
      applyUrl: normalizeWhitespace(job?.applyUrl) || sourceUrl,
      employmentType: normalizeWhitespace(job?.categories?.commitment),
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: toIsoDateTime(job?.createdAt),
      closingDate: null,
      jobDescription: normalizeWhitespace(job?.descriptionPlain),
      remoteStatus: toRemoteStatus(job?.workplaceType),
    }
  })
  .filter(Boolean)

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: DEFAULT_HEADERS,
  label: 'safesecurity',
})

export const createSafeSecurityScraper = () => ({
  async run({ fetchJson = defaultFetchJson } = {}) {
    const leverJobs = await fetchJson(LEVER_ENDPOINT)

    return extractSafeSecurityJobs(leverJobs).map((job) => ({
      ...job,
      source: 'safesecurity',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createSafeSecurityScraper().run()
