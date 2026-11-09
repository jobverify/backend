import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'
import { runKulaPublicApi } from '../../scraper-support/shared/kulaPublicApi.js'
import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { resolveKulaJobDescriptions } from '../../scraper-support/utils/kulaFlight.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://clevertap.com/current-openings/'
export const KULA_JOBS_URL = 'https://careers.kula.ai/clevertap?jobs=true'

const EMPLOYMENT_TYPE_MAP = {
  full_time: 'Full-time',
  contract: 'Contract',
  internship: 'Internship',
}

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toPublicJobUrl = (jobId) => `https://careers.kula.ai/clevertap/${jobId}/?jobs=true`

const parseEmbeddedJobs = (html) => {
  const serializedHtml = String(html ?? '')
  const patterns = [
    /\{\\"jobs\\":(\[.*?\]),\\"departments\\":/s,
    /\\"jobs\\":(\[.*?\]),\\"departments\\":/s,
  ]

  for (const pattern of patterns) {
    const match = serializedHtml.match(pattern)
    if (!match) continue

    try {
      return JSON.parse(
        match[1]
          .replace(/\\"/g, '"')
          .replace(/\\u0026/g, '&')
          .replace(/\\\\/g, '\\'),
      )
    } catch {
      return []
    }
  }

  return []
}

const isIndiaOffice = (office) => {
  const country = normalizeWhitespace(office?.country)
  if (country && /^india$/i.test(country)) return true

  const location = normalizeWhitespace(office?.location || office?.name)
  return Boolean(location && /(?:^|,\s*)india$/i.test(location))
}

const selectIndiaOffices = (offices = []) => {
  const explicitIndiaOffices = offices.filter(isIndiaOffice)
  if (!explicitIndiaOffices.length) return []

  const remoteIndiaOffices = offices.filter((office) => office?.remote && !isIndiaOffice(office))
  return [...explicitIndiaOffices, ...remoteIndiaOffices]
}

const normalizeLocation = (offices = []) => {
  const uniqueLocations = [...new Set(
    offices
      .map((office) => normalizeWhitespace(
        office?.location
        || office?.name
        || (office?.remote ? 'Remote' : null),
      ))
      .filter(Boolean),
  )]

  return uniqueLocations.length ? uniqueLocations.join('; ') : null
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  if (/^remote(?:\b|;)/i.test(normalized)) return 'Remote'
  return normalized.split(/[;,]/)[0]?.trim() || null
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  return EMPLOYMENT_TYPE_MAP[normalized] || null
}

const inferCountry = (offices = []) => {
  for (const office of offices) {
    const country = normalizeWhitespace(office?.country)
    if (country) return country
  }

  return 'India'
}

const extractDescription = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized || /^\$[0-9a-z]+$/i.test(normalized)) return null
  return normalized
}

export const buildSearchUrl = () => KULA_JOBS_URL

export const mapKulaJobs = (rows) => (
  rows
    .map((row) => {
      const title = normalizeWhitespace(row?.title)
      const jobId = normalizeWhitespace(row?.id)
      const offices = Array.isArray(row?.ats_job?.offices) ? row.ats_job.offices : []
      const indiaOffices = selectIndiaOffices(offices)
      const location = normalizeLocation(indiaOffices)
      const applyUrl = jobId ? toPublicJobUrl(jobId) : null

      if (!title || !jobId || !indiaOffices.length || !location || !applyUrl) {
        return null
      }

      return {
        title,
        company: 'CleverTap',
        department: normalizeWhitespace(row?.ats_job?.ats_department?.name),
        location,
        city: extractCity(location),
        country: inferCountry(indiaOffices),
        jobId,
        requisitionId: jobId,
        sourceUrl: applyUrl,
        applyUrl,
        employmentType: normalizeEmploymentType(row?.ats_job?.employment_type),
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: extractDescription(row?.ats_job?.job_description),
      }
    })
    .filter(Boolean)
    .sort((left, right) => left.title.localeCompare(right.title))
)

export const extractSearchResults = (html) => mapKulaJobs(
  resolveKulaJobDescriptions(html, parseEmbeddedJobs(html)),
)

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createCleverTapScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    if (!options.fetchText || options.fetchJson) return runKulaPublicApi({ source: 'clevertap', mapKulaJobs }, { maxJobs, ...options })
    const fetchText = options.fetchText || defaultFetchText
    const html = await fetchText(buildSearchUrl())
    const jobs = extractSearchResults(html)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: 'clevertap',
      sourceListingComplete: false,
      sourceDetailComplete: hasSourceDescription(job),
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createCleverTapScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running CleverTap scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'clevertap')
    console.log('DB result:', result)
    process.exit(0)
  }
}
