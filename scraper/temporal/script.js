import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import TEMPORAL_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

export const SOURCE = TEMPORAL_CATALOG.source
export const COMPANY = TEMPORAL_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = TEMPORAL_CATALOG.officialBrandName
export const VERIFIED_ON = TEMPORAL_CATALOG.verifiedOn
export const PROVIDER_METADATA = TEMPORAL_CATALOG
export const CAREERS_PAGE_URL = TEMPORAL_CATALOG.companyCareerPage
export const GREENHOUSE_BOARD_URL = TEMPORAL_CATALOG.greenhouseBoardUrl
export const GREENHOUSE_JOBS_API_URL = TEMPORAL_CATALOG.greenhouseJobsApiUrl

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const decodeHtml = (value) => normalizeWhitespace(value)

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
    Accept: 'application/json,text/plain,*/*',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/temporal\.io\/about["']/i.test(page)
    && normalized.includes('who we are')
    && normalized.includes('join us in shaping the future of technology')
    && normalized.includes("we're hiring")
    && page.includes(GREENHOUSE_BOARD_URL)
}

export const extractGreenhouseBoardUrl = (html = '') => {
  const match = String(html ?? '').match(
    /href=["'](https:\/\/job-boards\.greenhouse\.io\/temporaltechnologies(?:\?[^"']*)?)["']/i,
  )

  if (!match) return null

  try {
    const normalized = new URL(match[1])
    normalized.search = ''
    normalized.hash = ''
    return normalized.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

export const buildGreenhouseJobsApiUrl = () => `${GREENHOUSE_JOBS_API_URL}?content=true`

const isRetiredGreenhouseBoardError = (error) =>
  new RegExp(`HTTP 404 for ${GREENHOUSE_JOBS_API_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')
    .test(String(error?.message ?? error ?? ''))

const metadataIncludesIndia = (metadata = []) =>
  (Array.isArray(metadata) ? metadata : []).some((entry) => {
    const haystack = `${entry?.name ?? ''} ${Array.isArray(entry?.value) ? entry.value.join(' ') : entry?.value ?? ''}`
    return /\bindia\b/i.test(haystack)
  })

export const isIndiaJob = (job = {}) => {
  const locationText = [
    job?.location?.name,
    ...(Array.isArray(job?.offices) ? job.offices.map((office) => office?.location ?? office?.name) : []),
  ]
    .filter(Boolean)
    .join(' ')

  return /\bindia\b/i.test(locationText) || metadataIncludesIndia(job.metadata)
}

const inferCity = (locationName) => normalizeWhitespace(String(locationName ?? '').split(',')[0]) || null

const mapJob = (job = {}) => {
  const location = normalizeWhitespace(job?.location?.name)
  const sourceUrl = normalizeWhitespace(job?.absolute_url)
  const title = normalizeWhitespace(job?.title)

  if (!title || !location || !sourceUrl) return null

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(job?.departments?.[0]?.name) || null,
    location,
    city: inferCity(location),
    country: 'India',
    jobId: String(job?.id ?? ''),
    requisitionId: normalizeWhitespace(job?.requisition_id) || null,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(job?.first_published)?.slice(0, 10) || null,
    closingDate: null,
    jobDescription: decodeHtml(job?.content),
  }
}

export const extractIndiaJobsFromGreenhousePayload = (payload = {}) => {
  if (!Array.isArray(payload?.jobs)) {
    throw new Error('Temporal Greenhouse jobs API response no longer matches the expected payload')
  }

  return payload.jobs
    .filter(isIndiaJob)
    .map(mapJob)
    .filter(Boolean)
}

export const createTemporalScraper = ({
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = defaultNow,
  } = {}) {
    const aboutHtml = await fetchText(CAREERS_PAGE_URL)

    if (!hasOfficialCareersSignal(aboutHtml)) {
      throw new Error('Verified Temporal first-party about page changed materially')
    }

    if (extractGreenhouseBoardUrl(aboutHtml) !== GREENHOUSE_BOARD_URL) {
      throw new Error('Verified Temporal Greenhouse board handoff changed materially')
    }

    let payload
    try {
      payload = await fetchJson(buildGreenhouseJobsApiUrl())
    } catch (error) {
      // The still-linked Greenhouse board is retired and confirms no public roles remain.
      if (isRetiredGreenhouseBoardError(error)) return []
      throw error
    }

    const jobs = extractIndiaJobsFromGreenhousePayload(payload)

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createTemporalScraper(options).run(options)

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
