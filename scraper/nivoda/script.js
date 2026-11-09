import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { filterIndiaJobs } from '../../scraper-support/utils/indiaLocationFilter.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://nivoda.com/careers'
export const ASHBY_BOARD_URL = 'https://jobs.ashbyhq.com/nivoda'
export const ASHBY_JOB_BOARD_URL = 'https://api.ashbyhq.com/posting-api/job-board/nivoda'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeString = (value) => {
  if (value == null) return null
  const normalized = String(value).replace(/\s+/g, ' ').trim()
  return normalized || null
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeString(value)
  if (!normalized) return null
  return normalized.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ')
}

const getPostalAddress = (location = {}) => location?.address?.postalAddress || location?.address || {}

const toLocationCandidate = (location = {}, fallbackAddress = {}) => {
  const value = typeof location === 'string' ? { location } : location
  const address = getPostalAddress(value)
  const fallback = getPostalAddress(fallbackAddress)
  const label = normalizeString(value?.location || value?.name)
  const city = normalizeString(address?.addressLocality || value?.city || fallback?.addressLocality)
  const state = normalizeString(address?.addressRegion || value?.state || fallback?.addressRegion)
  const country = normalizeString(
    address?.addressCountry || value?.country || fallback?.addressCountry,
  )

  return {
    location: [city, state, country].filter(Boolean).join(', ') || label,
    city,
    state,
    country,
  }
}

const selectIndiaLocation = (job = {}) => {
  const candidates = [
    toLocationCandidate(job, job?.address),
    ...(Array.isArray(job?.secondaryLocations)
      ? job.secondaryLocations.map((location) => toLocationCandidate(location))
      : []),
  ].filter((candidate) => candidate.location)

  return candidates.find((candidate) => filterIndiaJobs([candidate]).length > 0) || null
}

const buildDetailUrl = (jobId) => `${ASHBY_BOARD_URL}/${encodeURIComponent(jobId)}`
const buildApplyUrl = (jobId) => `${buildDetailUrl(jobId)}/application`

export const extractAshbyJobs = (payload = {}) => (
  (Array.isArray(payload?.jobs) ? payload.jobs : [])
    .filter((job) => job?.isListed === true)
    .map((job) => {
      const title = normalizeString(job?.title)
      const jobId = normalizeString(job?.id)
      const selectedLocation = selectIndiaLocation(job)

      if (!title || !jobId || !selectedLocation) return null

      return {
        title,
        company: 'Nivoda',
        department: normalizeString(job?.department),
        location: selectedLocation.location,
        city: selectedLocation.city,
        state: selectedLocation.state,
        country: selectedLocation.country,
        jobId,
        requisitionId: jobId,
        sourceUrl: buildDetailUrl(jobId),
        applyUrl: buildApplyUrl(jobId),
        employmentType: normalizeEmploymentType(job?.employmentType),
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeString(job?.publishedAt),
        closingDate: null,
        jobDescription: normalizeString(job?.descriptionHtml),
      }
    })
    .filter(Boolean)
)

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
  },
  label: 'nivoda',
  timeoutMs: 15000,
})

export const createNivodaScraper = () => ({
  async run({ fetchJson = defaultFetchJson } = {}) {
    const payload = await fetchJson(ASHBY_JOB_BOARD_URL)

    return extractAshbyJobs(payload).map((job) => ({
      ...job,
      source: 'nivoda',
      link: job.applyUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createNivodaScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, 'nivoda')
}
