import {createNativeGetSource,nativeGetMetadata} from '../../scraper-support/native-sources/publicNativeGetSources/nativeCareers.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://www.joinodin.com/'
export const ASHBY_BOARD_URL = 'https://jobs.ashbyhq.com/odin'
export const ASHBY_JOB_BOARD_URL = 'https://api.ashbyhq.com/posting-api/job-board/odin'

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

const toLocation = (job = {}) => {
  const address = getPostalAddress(job)
  const location = normalizeString(job?.location)
  const city = normalizeString(address?.addressLocality)
  const state = normalizeString(address?.addressRegion)
  const country = normalizeString(address?.addressCountry)

  return {
    location: location || [city, state, country].filter(Boolean).join(', ') || null,
    city,
    state,
    country,
  }
}

export const extractAshbyJobs = (payload = {}) => (
  (Array.isArray(payload?.jobs) ? payload.jobs : [])
    .filter((job) => job?.isListed === true)
    .map((job) => {
      const title = normalizeString(job?.title)
      const jobId = normalizeString(job?.id)
      const sourceUrl = normalizeString(job?.jobUrl)
      const applyUrl = normalizeString(job?.applyUrl)
      const { location, city, state, country } = toLocation(job)

      if (!title || !jobId || !sourceUrl || !applyUrl || !location) return null

      return {
        title,
        company: 'Odin',
        department: normalizeString(job?.department),
        location,
        city,
        state,
        country,
        jobId,
        requisitionId: null,
        sourceUrl,
        applyUrl,
        employmentType: normalizeEmploymentType(job?.employmentType),
        workplaceType: normalizeString(job?.workplaceType),
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
  label: 'odin',
  timeoutMs: 15000,
})

export const PROVIDER_METADATA = nativeGetMetadata('odin')
export const createOdinScraper = (defaults = {}) => createNativeGetSource('odin', defaults)
export const run = async (options = {}) => createOdinScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, 'odin')
}
