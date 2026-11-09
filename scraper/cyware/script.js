import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREERS_API_URL = 'https://www.cyware.com/api/careers'

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim()
  return normalized || null
}

const createJobUrl = (jobId, title) => {
  const slug = title
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `https://cyware.zohorecruit.com/jobs/Careers/${jobId}/${slug}?source=CareerSite`
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (/full.?time/.test(normalized || '')) return 'Full-time'
  if (/part.?time/.test(normalized || '')) return 'Part-time'
  if (/contract|consultant/.test(normalized || '')) return 'Contract'
  if (/intern/.test(normalized || '')) return 'Internship'
  return normalizeWhitespace(value)
}

const getLocation = (record) => {
  const parts = [record.City, record.State, record.Country]
    .map(normalizeWhitespace)
    .filter(Boolean)

  return parts.join(', ') || null
}

export const extractIndiaJobs = (payload) => (
  Array.isArray(payload?.indiaJobs?.data) ? payload.indiaJobs.data : []
)
  .filter((record) => /india/i.test(normalizeWhitespace(record.Country) || ''))
  .map((record) => {
    const title = normalizeWhitespace(record.Posting_Title || record.Job_Opening_Name)
    const jobId = normalizeWhitespace(record.id)
    const location = getLocation(record)

    if (!title || !jobId || !location) return null

    const jobUrl = createJobUrl(jobId, title)
    return {
      title,
      company: 'Cyware',
      department: normalizeWhitespace(record.Client_Name?.name),
      location,
      city: normalizeWhitespace(record.City),
      state: normalizeWhitespace(record.State),
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: jobUrl,
      applyUrl: jobUrl,
      employmentType: normalizeEmploymentType(record.Job_Type),
      experienceRequired: normalizeWhitespace(record.Work_Experience),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: String(record.Required_Skills || '')
        .split(',')
        .map(normalizeWhitespace)
        .filter(Boolean),
      postingDate: normalizeWhitespace(record.Date_Opened),
      closingDate: null,
      jobDescription: normalizeWhitespace(record.Job_Description),
      remoteStatus: record.Remote_Job ? 'Remote' : 'On-site',
    }
  })
  .filter(Boolean)

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    Accept: 'application/json,text/plain,*/*',
  },
  label: 'cyware',
  timeoutMs: 15000,
})

export const createCywareScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({ fetchJson = defaultFetchJson } = {}) {
    const jobs = extractIndiaJobs(await fetchJson(CAREERS_API_URL))
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: 'cyware',
      link: job.applyUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createCywareScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()

  if (process.argv.includes('--dry-run')) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  }

  console.log(`Total India jobs scraped: ${jobs.length}`)
}
