import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://www.coditas.com/careers/job-opportunities'
export const JOBS_API_URL = 'https://4ht8rp26o5.execute-api.ap-south-1.amazonaws.com/prod/job-openings/get-openings'

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const stripHtml = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeLocation = (value) => {
  const city = normalizeWhitespace(value)
  if (!city) return { location: null, city: null }
  return {
    location: /india/i.test(city) ? city : `${city}, India`,
    city,
  }
}

const parseSkills = (value) => Array.isArray(value)
  ? value.map(normalizeWhitespace).filter(Boolean)
  : String(value ?? '')
    .split(',')
    .map(normalizeWhitespace)
    .filter(Boolean)

export const buildJobUrl = (jobId) =>
  `${CAREER_PAGE_URL.replace('/job-opportunities', '/job-apply')}?jobId=${encodeURIComponent(jobId)}`

export const extractJobs = (payload = {}) => (Array.isArray(payload?.data) ? payload.data : [])
  .filter((record) => record?.publish === true)
  .map((record) => {
    const jobId = normalizeWhitespace(record?.id || record?.jobId)
    const title = normalizeWhitespace(record?.jobPostTitle)
    const { location, city } = normalizeLocation(record?.city)
    const sourceUrl = jobId ? buildJobUrl(jobId) : null

    if (!jobId || !title || !location || !sourceUrl) return null

    return {
      title,
      company: 'Coditas Solutions LLP',
      department: normalizeWhitespace(record?.category),
      location,
      city,
      country: 'India',
      jobId,
      requisitionId: normalizeWhitespace(record?.jobId) || jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: normalizeWhitespace(record?.jobType),
      experienceRequired: normalizeWhitespace(record?.workExpRequired),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: parseSkills(record?.requiredSkills),
      postingDate: null,
      closingDate: null,
      jobDescription: stripHtml(record?.jobDescription) || normalizeWhitespace(record?.jdSummary),
    }
  })
  .filter(Boolean)

const fetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json,text/plain,*/*',
      'User-Agent': 'Mozilla/5.0 (compatible; JobverifyScraper/1.0)',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const createCoditasScraper = () => ({
  async run({ fetchJson: requestJson = fetchJson } = {}) {
    const jobs = extractJobs(await requestJson(JOBS_API_URL))
    return jobs.map((job) => ({
      ...job,
      source: 'coditas',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createCoditasScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Coditas scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'coditas')
    console.log('DB result:', result)
    process.exit(0)
  }
}
