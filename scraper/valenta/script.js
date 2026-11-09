import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const API_URL =
  'https://valentabpo.zohorecruit.com/recruit/v2/public/Job_Openings?source=CareerSite&pagename=Careers&extra_fields=%5B%22Work_Experience%22,%22Job_Description%22,%22Date_Opened%22%5D'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/intern/.test(normalized)) return 'Internship'
  if (/contract|consultant/.test(normalized)) return 'Contract'
  if (/part.?time/.test(normalized)) return null
  if (/full.?time/.test(normalized)) return 'Full-time'
  return normalizeWhitespace(value)
}

const normalizeLocation = (record = {}) => {
  const city = normalizeWhitespace(record.City)
  const country = normalizeWhitespace(record.Country)

  if (city && country) return { location: `${city}, ${country}`, city }
  if (country) return { location: country, city: null }
  if (city) return { location: city, city }
  return { location: null, city: null }
}

const toDateOnly = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const slashMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    const [, month, day, year] = slashMatch
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return null

  return [
    parsed.getUTCFullYear(),
    String(parsed.getUTCMonth() + 1).padStart(2, '0'),
    String(parsed.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

// Valenta's public feed includes fully remote roles with blank country fields.
// Keep the scraper aligned with the India-only catalog contract.
const isIndiaJob = (record = {}) => /india/i.test(normalizeWhitespace(record.Country) || '')

export const buildApiUrl = () => API_URL

export const extractSearchResults = (payload) =>
  (Array.isArray(payload?.data) ? payload.data : [])
    .filter((record) => isIndiaJob(record))
    .map((record) => {
      const title = normalizeWhitespace(record.Job_Opening_Name || record.Posting_Title)
      const jobId = normalizeWhitespace(record.id)
      const sourceUrl = normalizeWhitespace(record.$url)
      const { location, city } = normalizeLocation(record)

      if (!title || !jobId || !sourceUrl || !location) return null

      return {
        title,
        company: 'Valenta',
        department: normalizeWhitespace(record.Industry),
        location,
        city,
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: normalizeEmploymentType(record.Job_Type),
        experienceRequired: normalizeWhitespace(record.Work_Experience),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: toDateOnly(record.Date_Opened),
        closingDate: null,
        jobDescription: normalizeWhitespace(record.Job_Description),
        publicExperienceChecked: Boolean(
          normalizeWhitespace(record.Work_Experience) || normalizeWhitespace(record.Job_Description),
        ),
      }
    })
    .filter(Boolean)

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'application/json,text/plain,*/*',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const createValentaScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchJson = options.fetchJson || defaultFetchJson
    const payload = await fetchJson(buildApiUrl())
    const listings = extractSearchResults(payload)
    const selectedJobs = maxJobs ? listings.slice(0, maxJobs) : listings

    return selectedJobs.map((job) => ({
      ...job,
      source: 'valenta',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createValentaScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Valenta scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'valenta')
    console.log('DB result:', result)
    process.exit(0)
  }
}
