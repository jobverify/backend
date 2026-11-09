import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const API_URL = 'https://www.inmobi.com/api/v1/careersapi'
const JOB_BASE_URL = 'https://www.inmobi.com/company/openings'

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || 'job'

const extractCity = (location) => normalizeWhitespace(location)?.split(',')[0] || null

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return { location: null, city: null }
  if (/india/i.test(normalized)) {
    return {
      location: normalized,
      city: extractCity(normalized),
    }
  }

  return {
    location: `${normalized}, India`,
    city: extractCity(normalized),
  }
}

const normalizeEmploymentType = (rawType, title) => {
  const type = normalizeWhitespace(rawType)?.toLowerCase() || ''
  const normalizedTitle = normalizeWhitespace(title)?.toLowerCase() || ''
  const haystack = `${type} ${normalizedTitle}`

  if (/intern|internship|trainee|apprentice/.test(haystack)) return 'Internship'
  if (/contract|consultant|contractor|freelance/.test(haystack)) return 'Contract'
  if (/part.?time/.test(haystack)) return null
  if (/full.?time/.test(haystack)) return 'Full-time'
  return null
}

const isIndiaJob = (record = {}) => {
  const countries = Array.isArray(record.jobCountry) ? record.jobCountry : []
  return countries.some((country) => /india/i.test(String(country)))
    || /india/i.test(String(record.jobLocation || ''))
}

export const buildJobUrl = (jobDepartment, jobId) =>
  `${JOB_BASE_URL}/${slugify(jobDepartment)}/jobid/${jobId}`

export const extractSearchResults = (payload) => {
  const groups = Array.isArray(payload) ? payload : [payload]

  return groups
    .flatMap((group) => Array.isArray(group?.jobArr) ? group.jobArr : [])
    .filter((record) => isIndiaJob(record))
    .map((record) => {
      const jobId = normalizeWhitespace(record.jobId)
      const title = normalizeWhitespace(record.jobTitle)
      const requisitionId = normalizeWhitespace(record.reqId)
      const sourceUrl = jobId ? buildJobUrl(record.jobDepartment, jobId) : null
      const { location, city } = normalizeLocation(record.jobLocation)

      if (!jobId || !title || !requisitionId || !sourceUrl || !location) return null

      return {
        title,
        company: 'InMobi',
        department: null,
        location,
        city,
        jobId,
        requisitionId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: normalizeEmploymentType(record.jobDepartment, title),
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
      }
    })
    .filter(Boolean)
}

const fetchJson = async (url) => {
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

export const run = async () => {
  const payload = await fetchJson(API_URL)
  const jobs = extractSearchResults(payload)
  const maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null
  const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

  return selectedJobs.map((job) => ({
    ...job,
    source: 'inmobi',
    link: job.applyUrl || job.sourceUrl,
    scrapedAt: new Date().toISOString(),
  }))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running InMobi scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'inmobi')
    console.log('DB result:', result)
    process.exit(0)
  }
}
