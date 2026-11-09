import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'zerodha'
export const COMPANY_NAME = 'Zerodha'
export const COMPANY = COMPANY_NAME
export const VERIFIED_ON = '2026-07-25'
export const OFFICIAL_SITE_URL = 'https://zerodha.com/'
export const CAREERS_PAGE_URL = 'https://careers.zerodha.com/'
export const JOBS_API_URL = `${CAREERS_PAGE_URL}api/jobs`

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const stripHtml = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeJob = (item) => {
  const title = String(item.job_title ?? item.title ?? '').trim()
  const jobId = String(item.name ?? slugify(title)).trim()
  if (!title || !jobId) return null

  const location = String(item.location ?? '').trim() || null
  const link = `${CAREERS_PAGE_URL}#${encodeURIComponent(jobId)}`

  return {
    title,
    company: COMPANY,
    department: item.department || null,
    location,
    city: location?.split(',')[0]?.trim() || null,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: link,
    applyUrl: link,
    employmentType: item.employment_type || item.employmentType || null,
    experienceRequired: item.experience || item.experience_required || null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: item.posting_date || item.postingDate || null,
    closingDate: item.closing_date || item.closingDate || null,
    jobDescription: stripHtml(item.description || item.job_description) || null,
    remoteStatus: item.work_mode || item.remote_status || null,
  }
}

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    Accept: 'application/json',
    'User-Agent': 'Jobverify scraper; official Zerodha careers API',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const parseJobsResponse = (payload) => {
  if (
    !payload
    || payload.success !== true
    || !Array.isArray(payload.data)
    || !Number.isInteger(payload.count)
  ) {
    throw new Error('The verified Zerodha jobs API response changed materially')
  }

  if (payload.count !== payload.data.length) {
    throw new Error('The verified Zerodha jobs API count does not match its data')
  }

  return payload.data.map(normalizeJob).filter(Boolean)
}

export const createZerodhaScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchJson = defaultFetchJson } = {}) {
    const jobs = parseJobsResponse(await fetchJson(JOBS_API_URL))
    const scrapedAt = now()

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createZerodhaScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()

  if (process.argv.includes('--dry-run')) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
