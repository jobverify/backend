import path from 'node:path'
import { fileURLToPath } from 'node:url'
import https from 'node:https'

export const CAREER_PAGE_URL = 'https://burnsmcd.jobs/locations/ind/jobs/'
export const API_ENDPOINT = 'https://prod-search-api.jobsyn.org/api/v1/solr/search'
export const PAGE_SIZE = 15
export const REQUEST_HEADERS = {
  Accept: 'application/json',
  'X-Origin': 'burnsmcd.jobs',
  Referer: 'https://burnsmcd.jobs/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
}

const COMPANY = 'Burns & McDonnell'
const SOURCE = 'burnsmcdonnell'
const currentDir = path.dirname(fileURLToPath(import.meta.url))

const slugifySegment = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const deriveCity = (location) => String(location || '').split(',')[0]?.trim() || null

const normalizeEmploymentType = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return null
  if (normalized === 'full-time') return 'Full-time'
  if (normalized === 'part-time') return 'Part-time'
  if (normalized === 'contract') return 'Contract'
  return String(value).trim() || null
}

const buildJobUrl = (job) => {
  const locationSlug = slugifySegment(job.location_exact)
  const titleSlug = slugifySegment(job.title_slug)
  const guid = String(job.guid || '').trim()

  if (!locationSlug || !titleSlug || !guid) return null
  return `https://burnsmcd.jobs/${locationSlug}/${titleSlug}/${guid}/job/`
}

const fetchJsonWithHttps = (url, { headers = {} } = {}) =>
  new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          ...REQUEST_HEADERS,
          ...headers,
        },
      },
      (response) => {
        const chunks = []

        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8')

          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode} for ${url}`))
            return
          }

          try {
            resolve(JSON.parse(body))
          } catch (error) {
            reject(new Error(`Invalid JSON from ${url}: ${error.message}`))
          }
        })
      },
    )

    request.on('error', reject)
  })

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const fetchJsonWithRetry = async (url, { headers = {}, attempts = 3 } = {}) => {
  let lastError = null

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetchJsonWithHttps(url, { headers })
    } catch (error) {
      lastError = error
      if (attempt === attempts) break
      await sleep(attempt * 1000)
    }
  }

  throw lastError
}

export const mapBurnsJob = (job) => {
  const jobUrl = buildJobUrl(job)
  if (!jobUrl) return null

  return {
    title: job.title_exact || null,
    company: COMPANY,
    department: job.job_category || null,
    location: job.location_exact || null,
    city: deriveCity(job.location_exact),
    country: job.country_exact || 'India',
    jobId: job.guid || null,
    requisitionId: job.reqid || null,
    sourceUrl: jobUrl,
    applyUrl: jobUrl,
    employmentType: normalizeEmploymentType(job.job_shift),
    experienceRequired: job.job_type || null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: job.date_new || job.date_updated || null,
    closingDate: null,
    jobDescription: job.description || null,
    publicExperienceChecked: true,
    remoteStatus: Array.isArray(job.on_sites) && job.on_sites.includes(0) ? 'On-site' : null,
  }
}

export const createBurnsMcDonnellScraper = () => ({
  async run({ fetchJson = fetchJsonWithRetry } = {}) {
    const jobs = []
    let page = 1

    while (true) {
      const url = `${API_ENDPOINT}?page=${page}&location=ind&num_items=${PAGE_SIZE}`
      const payload = await fetchJson(url, { headers: REQUEST_HEADERS })
      const pageJobs = Array.isArray(payload?.jobs) ? payload.jobs : []

      for (const rawJob of pageJobs) {
        const mapped = mapBurnsJob(rawJob)
        if (!mapped) continue

        jobs.push({
          ...mapped,
          source: SOURCE,
          link: mapped.applyUrl,
          scrapedAt: new Date().toISOString(),
        })
      }

      if (!payload?.pagination?.has_more_pages || pageJobs.length === 0) break
      page += 1
    }

    return jobs
  },
})

export const run = async () => createBurnsMcDonnellScraper().run()

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
