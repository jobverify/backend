import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

export const CAREER_PAGE_URL = 'https://www.genesys.com/company/careers'
export const BASE_URL = 'https://genesys.wd1.myworkdayjobs.com/Genesys'
export const JOBS_API_URL = 'https://genesys.wd1.myworkdayjobs.com/wday/cxs/genesys/Genesys/jobs'
export const INDIA_COUNTRY_FACET_ID = 'c4f78be1a8f14da0ab49ce1162348a5e'

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; JobverifyBot/1.0)',
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value).replace(/\s+/g, ' ').trim()
  return normalized || null
}

const GROUPED_LOCATION_PATTERN = /^\d+\s+locations?$/i

const extractRequisitionId = (job = {}) =>
  normalizeWhitespace(job?.bulletFields?.[0])
  || normalizeWhitespace(job?.externalPath?.match(/_([A-Z]{1,5}\d+(?:-\d+)?)$/i)?.[1])

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  if (GROUPED_LOCATION_PATTERN.test(normalized)) return null
  if (/^virtual office\b/i.test(normalized) || /\bremote\b/i.test(normalized)) return null

  return normalizeWhitespace(
    normalized
      .replace(/\s*\(Flexible\)\s*$/i, '')
      .replace(/\s*,\s*India\s*$/i, '')
      .split(',')[0],
  )
}

const toRemoteStatus = (location) => (
  /^virtual office\b/i.test(normalizeWhitespace(location) || '')
  || /\bremote\b/i.test(normalizeWhitespace(location) || '')
    ? 'Remote'
    : null
)

export const buildJobsApiRequest = (offset = 0, limit = 20) => ({
  appliedFacets: {
    locationCountry: [INDIA_COUNTRY_FACET_ID],
  },
  limit,
  offset,
  searchText: '',
})

export const buildJobUrl = (externalPath) => {
  const normalizedPath = normalizeWhitespace(externalPath)
  if (!normalizedPath) return null
  if (/^https?:\/\//i.test(normalizedPath)) return normalizedPath

  const base = BASE_URL.replace(/\/$/, '')
  const path = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`
  return `${base}${path}`
}

export const mapJobPosting = (job) => {
  const sourceUrl = normalizeWhitespace(
    job?.externalPath ? buildJobUrl(job.externalPath) : null,
  )
  const requisitionId = extractRequisitionId(job)
  const location = normalizeWhitespace(job?.locationsText)

  if (!sourceUrl || !requisitionId || !location) {
    return null
  }

  return {
    title: normalizeWhitespace(job?.title),
    company: 'Genesys',
    department: null,
    location,
    city: extractCity(location),
    country: 'India',
    jobId: requisitionId,
    requisitionId,
    sourceUrl,
    applyUrl: `${sourceUrl}/apply`,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: toRemoteStatus(location),
  }
}

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  ...options,
  headers: {
    ...DEFAULT_HEADERS,
    ...(options.headers || {}),
  },
  label: 'genesys',
})

export const createGenesysScraper = ({ pageSize = 20 } = {}) => ({
  async run({ fetchJson = defaultFetchJson } = {}) {
    const jobs = []
    let offset = 0
    let total = Number.POSITIVE_INFINITY

    while (offset < total) {
      const payload = await fetchJson(JOBS_API_URL, {
        method: 'POST',
        body: JSON.stringify(buildJobsApiRequest(offset, pageSize)),
      })
      const jobPostings = Array.isArray(payload?.jobPostings) ? payload.jobPostings : []

      total = Number.isFinite(payload?.total) ? payload.total : offset + jobPostings.length
      offset += jobPostings.length

      jobs.push(
        ...jobPostings
          .map((job) => mapJobPosting(job))
          .filter(Boolean),
      )

      if (jobPostings.length < pageSize) {
        break
      }
    }

    return jobs.map((job) => ({
      ...job,
      source: 'genesys',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createGenesysScraper().run()
