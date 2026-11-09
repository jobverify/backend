import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'springboard'
export const COMPANY_NAME = 'Springboard'
export const GREENHOUSE_COMPANY_NAME = 'Springboard Roles'
export const CAREERS_URL = 'https://www.springboard.com/join-us/'
export const GREENHOUSE_BOARD_URL = 'https://job-boards.greenhouse.io/springboard'
export const GREENHOUSE_JOBS_API_URL = 'https://boards-api.greenhouse.io/v1/boards/springboard/jobs'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const defaultFetchJson = (url, { signal } = {}) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: CAREERS_URL,
  },
  label: SOURCE,
  timeoutMs: 15000,
  signal,
})

export const buildGreenhouseJobsApiUrl = () => `${GREENHOUSE_JOBS_API_URL}?content=true`

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return normalized.includes('Help build the future of education')
    && normalized.includes('Working at Springboard')
    && /boards\.greenhouse\.io\/springboard(?:[\/?"'#]|$)/i.test(page)
}

export const normalizeGreenhouseJobUrl = (value, jobId) => {
  const canonicalJobId = normalizeWhitespace(jobId)
  if (!canonicalJobId) return null

  try {
    const url = new URL(value)
    if (url.hostname.toLowerCase() !== 'job-boards.greenhouse.io') return null
    if (url.pathname.replace(/\/+$/, '') !== `/springboard/jobs/${canonicalJobId}`) return null
    return `https://job-boards.greenhouse.io/springboard/jobs/${canonicalJobId}`
  } catch {
    return null
  }
}

const getIndiaLocation = (job = {}) => {
  const locations = [
    normalizeWhitespace(job?.location?.name),
    ...(Array.isArray(job?.offices) ? job.offices.map((office) => normalizeWhitespace(office?.location || office?.name)) : []),
    ...(Array.isArray(job?.metadata) ? job.metadata.map((entry) => normalizeWhitespace(entry?.value)) : []),
  ].filter(Boolean)

  return locations.find((location) => /\bindia\b/i.test(location)) || null
}

export const extractIndiaJobsFromGreenhousePayload = (payload, { scrapedAt = new Date().toISOString() } = {}) => {
  if (!Array.isArray(payload?.jobs)) {
    throw new Error('Springboard Greenhouse jobs API response no longer matches the expected payload')
  }

  return payload.jobs.flatMap((job) => {
    const companyName = normalizeWhitespace(job?.company_name)
    const title = normalizeWhitespace(job?.title)
    const sourceUrl = normalizeGreenhouseJobUrl(job?.absolute_url, job?.id)

    if (companyName !== GREENHOUSE_COMPANY_NAME) {
      throw new Error('Springboard Greenhouse payload no longer maps to the verified company identity')
    }
    if (!title || !sourceUrl) {
      throw new Error('Springboard Greenhouse payload no longer exposes the verified detail route')
    }

    const location = getIndiaLocation(job)
    if (!location) return []

    return [{
      title,
      company: COMPANY_NAME,
      location,
      city: null,
      country: 'India',
      link: sourceUrl,
      applyUrl: sourceUrl,
      sourceUrl,
      source: SOURCE,
      jobId: String(job.id),
      requisitionId: normalizeWhitespace(job?.requisition_id),
      department: normalizeWhitespace(job?.departments?.[0]?.name),
      employmentType: null,
      experienceRequired: null,
      jobDescription: normalizeWhitespace(job?.content),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: normalizeWhitespace(job?.updated_at || job?.first_published),
      closingDate: null,
      scrapedAt,
    }]
  })
}

export const createSpringboardScraper = () => ({
  async run({ fetchJson = defaultFetchJson, now = () => new Date().toISOString(), signal } = {}) {
    return extractIndiaJobsFromGreenhousePayload(
      await fetchJson(buildGreenhouseJobsApiUrl(), { signal }),
      { scrapedAt: now() },
    )
  },
})

export const run = async (options = {}) => createSpringboardScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()

  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
