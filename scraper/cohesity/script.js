import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { extractWorkdayJobDetail } from '../../scraper-support/detailExtractors/workday.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const OPEN_POSITIONS_PAGE_URL = 'https://www.cohesity.com/careers/open-positions/'
export const OPEN_POSITIONS_API_URL = 'https://www.cohesity.com/bin/cohesity/open-positions'

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;|&rsquo;|&#8217;/gi, "'")
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#8212;|&mdash;/gi, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalized
    .replace(/\s*-\s*India\s*\(Office\)/i, ', India')
    .replace(/^India\s*-\s*Remote$/i, 'India - Remote')
    .replace(/^Cohesity\s*-\s*/i, '')
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  if (/^India\s*-\s*Remote$/i.test(normalized)) return null

  return normalized
    .replace(/,\s*India$/i, '')
    .split(/\s*-\s*|,\s*/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)[0] || null
}

const flattenJobData = (payload) => Object.values(payload?.job_data || {})
  .flatMap((group) => Array.isArray(group) ? group : [])

const isIndiaJob = (job = {}) => normalizeWhitespace(job.country) === 'India'

export const hasOpenPositionsSignal = (payload) =>
  Array.isArray(payload?.careerSiteDeptList)
  && payload?.job_data
  && payload?.locationsByCountry

export const buildPublicDetailUrl = (value) =>
  normalizeWhitespace(String(value ?? '').replace(/\/apply\/?$/i, ''))

export const hasUnavailableWorkdayPosting = (html = '') => /postingAvailable:\s*false/i.test(String(html ?? ''))

export const extractSearchResults = (payload) => flattenJobData(payload)
  .filter((job) => isIndiaJob(job))
  .map((job) => {
    const location = normalizeLocation(job.primaryLocation)

    return {
      title: normalizeWhitespace(job.title),
      company: normalizeWhitespace(job.company) || 'Cohesity',
      department: normalizeWhitespace(job.careerSiteDept),
      location,
      city: extractCity(location),
      country: 'India',
      jobId: normalizeWhitespace(job.JobID) || normalizeWhitespace(job.req_id),
      requisitionId: normalizeWhitespace(job.req_id) || normalizeWhitespace(job.JobID),
      sourceUrl: normalizeWhitespace(job.jobUrl),
      applyUrl: normalizeWhitespace(job.jobUrl),
      employmentType: normalizeWhitespace(job.categories),
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      jobType: normalizeWhitespace(job.jobType),
      additionalLocations: normalizeWhitespace(job.AdditionalLocations) || null,
    }
  })
  .filter((job) => job.title && job.sourceUrl && job.requisitionId)

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'application/json,text/plain,*/*',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'cohesity-detail',
  timeoutMs: 15000,
})

export const enrichJobFromDetailPage = (job = {}, detailHtml = '') => {
  const detail = extractWorkdayJobDetail(detailHtml)
  const publicDetailUrl = buildPublicDetailUrl(job.sourceUrl || job.applyUrl)
  const hasPublicEvidence =
    Boolean(detail.experienceRequired)
    || detail.publicExperienceChecked === true
    || hasUnavailableWorkdayPosting(detailHtml)

  return {
    ...job,
    sourceUrl: publicDetailUrl || job.sourceUrl,
    experienceRequired: detail.experienceRequired || job.experienceRequired || null,
    minimumQualification: detail.minimumQualification || job.minimumQualification || null,
    preferredQualification: detail.preferredQualification || job.preferredQualification || null,
    requiredSkills: detail.requiredSkills?.length ? detail.requiredSkills : job.requiredSkills,
    postingDate: detail.postingDate || job.postingDate || null,
    department: detail.department || job.department || null,
    requisitionId: detail.requisitionId || job.requisitionId,
    jobDescription: detail.jobDescription || job.jobDescription || null,
    publicExperienceChecked: hasPublicEvidence,
  }
}

export const createCohesityScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  fetchJson = defaultFetchJson,
  fetchText = defaultFetchText,
} = {}) => ({
  async run() {
    const payload = await fetchJson(OPEN_POSITIONS_API_URL)

    if (!hasOpenPositionsSignal(payload)) {
      return []
    }

    const jobs = extractSearchResults(payload)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs
    const enrichedJobs = await Promise.all(selectedJobs.map(async (job) => {
      const detailUrl = buildPublicDetailUrl(job.sourceUrl || job.applyUrl)
      if (!detailUrl) return job

      try {
        const detailHtml = await fetchText(detailUrl)
        return enrichJobFromDetailPage(job, detailHtml)
      } catch {
        return job
      }
    }))

    return enrichedJobs.map((job) => ({
      ...job,
      source: 'cohesity',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createCohesityScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Cohesity scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'cohesity')
    console.log('DB result:', result)
    process.exit(0)
  }
}
