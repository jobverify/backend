import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { loadNativePaginationDefaults, nativePaginationLimits, createNativePagination, readNativeWithSignal } from '../../scraper-support/utils/nativePagination.js'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)
const nativeDefaults = loadNativePaginationDefaults(currentDir)
const NAVIGATION_TIMEOUT_MS = Math.max(config.jobListingTimeoutMs || 0, 60000)

export const COMPANY_NAME = 'Schneider Electric'
export const SOURCE = 'schneiderelectric'
export const BASE_URL = 'https://careers.se.com'
export const OFFICIAL_CAREERS_URL = 'https://www.se.com/ww/en/about-us/careers/overview/'
export const OFFICIAL_JOBS_URL = 'https://careers.se.com/jobs?lang=en-US'
export const INDIA_COUNTRY = 'India'
export const DEFAULT_PAGE_SIZE = 10

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/full[_\s-]?time/i.test(normalized)) return 'Full-time'
  if (/part[_\s-]?time/i.test(normalized)) return 'Part-time'
  if (/contract/i.test(normalized)) return 'Contract'
  if (/intern/i.test(normalized)) return 'Internship'
  return normalized
}

const extractExperienceRequired = (job = {}) => {
  const publicEvidence = normalizeWhitespace([
    job.description,
    job.responsibilities,
    job.qualifications,
  ].filter(Boolean).join(' '))
  if (!publicEvidence) return null

  const experienceProfile = extractJobFilterSignals({
    description: publicEvidence,
  })?.experienceProfile
  const evidence = normalizeWhitespace(experienceProfile?.evidence)
  if (!evidence || experienceProfile?.confidence !== 'high') {
    return null
  }

  return (
    experienceProfile.minimumYears === 0 && experienceProfile.maximumYears === 0
      ? 'No experience required'
      : evidence
  )
}

const isIndiaJob = (job = {}) => {
  const country = normalizeWhitespace(job.country)
  const countryCode = normalizeWhitespace(job.country_code)?.toUpperCase()
  return country === INDIA_COUNTRY || countryCode === 'IN'
}

const getLocation = (job = {}) =>
  normalizeWhitespace(job.tags9?.[0])
  || normalizeWhitespace(job.full_location)
  || normalizeWhitespace([job.city, job.state, job.country].filter(Boolean).join(', '))
  || normalizeWhitespace(job.location_name?.replaceAll('-', ', '))

const getDepartment = (job = {}) =>
  normalizeWhitespace(job.categories?.[0]?.name)
  || normalizeWhitespace(job.category?.[0])
  || normalizeWhitespace(job.category)

const buildCanonicalJobUrl = (job = {}) => {
  const jobId = normalizeWhitespace(job.req_id || job.slug)
  const language = normalizeWhitespace(job.language)?.toLowerCase() || 'en-us'
  return jobId ? `${BASE_URL}/jobs/${jobId}?lang=${language}` : null
}

export const buildIndiaJobsApiUrl = ({ page = 1 } = {}) => {
  const url = new URL('/api/jobs', BASE_URL)
  url.searchParams.set('lang', 'en-US')
  url.searchParams.set('page', String(page))
  url.searchParams.set('sortBy', 'relevance')
  url.searchParams.set('descending', 'false')
  url.searchParams.set('internal', 'false')
  url.searchParams.set('country', INDIA_COUNTRY)
  return url.toString()
}

export const extractJobsPayload = (payload = {}) => ({
  jobs: Array.isArray(payload.jobs) ? payload.jobs : [],
  totalCount: Number.isInteger(payload.totalCount) ? payload.totalCount : 0,
  count: Number.isInteger(payload.count) ? payload.count : 0,
})

export const normalizeJobListing = (item = {}) => {
  const job = item?.data || {}
  if (!isIndiaJob(job)) return null

  const jobDescription = normalizeWhitespace(job.description || job.responsibilities)
  const minimumQualification = normalizeWhitespace(job.qualifications)

  return {
    title: normalizeWhitespace(job.title),
    location: getLocation(job),
    city: normalizeWhitespace(job.city),
    country: normalizeWhitespace(job.country),
    jobId: normalizeWhitespace(job.req_id || job.slug),
    requisitionId: normalizeWhitespace(job.req_id || job.slug),
    department: getDepartment(job),
    employmentType: normalizeEmploymentType(job.employment_type || job.tags1?.[0]),
    experienceRequired: extractExperienceRequired(job),
    jobDescription,
    minimumQualification,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(job.posted_date),
    closingDate: normalizeWhitespace(job.posting_expiry_date),
    applyUrl: normalizeWhitespace(job.apply_url),
    sourceUrl: buildCanonicalJobUrl(job),
    publicExperienceChecked: Boolean(jobDescription || minimumQualification),
  }
}

const defaultFetchJson = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    signal,
    headers: { Accept: 'application/json,text/plain,*/*' },
  })
  if (!response.ok) throw new Error(`Schneider Electric jobs API returned HTTP ${response.status}`)
  return response.json()
}

export const createSchneiderElectricScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  buildIndiaJobsApiUrl,
  extractJobsPayload,
  normalizeJobListing,
  run: async ({
    maxPages,
    maxJobs,
    fetchJson,
    signal,
    collectionBudgetMs,
  } = {}) => {
    {
      fetchJson ||= defaultFetchJson
      signal?.throwIfAborted()
      const limits = nativePaginationLimits({ maxPages, maxJobs }, nativeDefaults)
      const pagination = createNativePagination({ surface: buildIndiaJobsApiUrl(), limits, signal, collectionBudgetMs, identityScope: 'native-raw' })

      const jobs = []
      return pagination.run(jobs, async () => {
        const seenJobIds = new Set()

        for (let page = 1; page <= limits.maxPages; page += 1) {
          const payload = extractJobsPayload(await readNativeWithSignal(() => fetchJson(buildIndiaJobsApiUrl({ page }), { signal: pagination.signal }), pagination.signal))
          const progress = pagination.page(payload.jobs.map(item => normalizeWhitespace(item?.data?.req_id || item?.data?.slug)), payload.totalCount || null)
          if (!progress) return pagination.finish(jobs, { exhausted: !payload.jobs.length && !payload.totalCount })

          for (const item of payload.jobs) {
            const normalized = normalizeJobListing(item)
            if (!normalized?.jobId || seenJobIds.has(normalized.jobId)) continue
            seenJobIds.add(normalized.jobId)

            jobs.push({
              ...normalized,
              company: COMPANY_NAME,
              source: SOURCE,
              link: normalized.applyUrl || normalized.sourceUrl,
              scrapedAt: now(),
            })

            if (jobs.length >= limits.maxJobs) return pagination.finish(jobs)
          }

          if (payload.totalCount ? page * DEFAULT_PAGE_SIZE >= payload.totalCount : payload.jobs.length < DEFAULT_PAGE_SIZE) {
            return pagination.finish(jobs, { exhausted: true })
          }
        }

        return pagination.finish(jobs)
      })
    }
  },
})

const scraper = createSchneiderElectricScraper()

export const {
  run,
} = scraper

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Schneider Electric scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)
  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
