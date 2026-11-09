import path from 'path'
import { fileURLToPath } from 'url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { readParadoxPreload, createParadoxPublicScraper } from '../../scraper-support/shared/paradoxPublicInventory.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const BASE_URL = 'https://careers.fedex.com'
const COUNTRY_FILTER_QUERY = 'filter[country][0]=India'
const DEFAULT_PAGE_SIZE = 25
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const isoDateMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoDateMatch) return normalized

  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

const buildAbsoluteUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, `${BASE_URL}/`).toString()
  } catch {
    return null
  }
}

const getCustomFieldMap = (customFields) => Object.fromEntries(
  (Array.isArray(customFields) ? customFields : [])
    .map((field) => [
      normalizeWhitespace(field?.cfKey),
      normalizeWhitespace(field?.value),
    ])
    .filter(([key]) => Boolean(key)),
)

const toCountry = (location = {}) => {
  const country = normalizeWhitespace(location.country)
  if (country) return country

  return String(location.countryAbbr || '').toUpperCase() === 'IN' ? 'India' : null
}

const toLocation = (location = {}) => {
  const cityState = normalizeWhitespace(location.cityState)
  const city = normalizeWhitespace(location.city)
  const state = normalizeWhitespace(location.state)
  const country = toCountry(location)
  const baseLocation = cityState || [city, state].filter(Boolean).join(', ') || null

  if (baseLocation && country && !baseLocation.endsWith(country)) {
    return `${baseLocation}, ${country}`
  }

  return baseLocation || country || normalizeWhitespace(location.locationParsedText) || normalizeWhitespace(location.locationText)
}

const toEmploymentType = (value) => {
  if (!Array.isArray(value)) return normalizeWhitespace(value)

  return value.map((part) => normalizeWhitespace(part)).filter(Boolean).join(', ') || null
}

const toCompensation = (customFieldMap) => {
  const currency = customFieldMap.cf_currency_id
  const minimum = customFieldMap.cf_compensation_pay_range_data_minimum
  const maximum = customFieldMap.cf_compensation_pay_range_data_maximum
  const frequency = normalizeWhitespace(customFieldMap.cf_frequency_id)?.toLowerCase()

  if (!currency || (!minimum && !maximum) || !frequency) return null
  const normalizedFrequency = frequency === 'monthly' ? 'month' : frequency
  if (minimum && maximum) return `${currency} ${minimum}-${maximum} per ${normalizedFrequency}`

  return `${currency} ${minimum || maximum} per ${normalizedFrequency}`
}

const toRemoteStatus = (job = {}, location = {}) =>
  (job.isRemote || location.isRemote) ? 'Remote' : 'On-site'

const toJob = (job = {}) => {
  const location = Array.isArray(job.locations) ? job.locations[0] || {} : {}
  const customFieldMap = getCustomFieldMap(job.customFields)
  const jobId = normalizeWhitespace(job.reference) || normalizeWhitespace(customFieldMap.cf_shorten_job_id)
  const sourceUrl = buildAbsoluteUrl(job.originalURL)
  const applyUrl = normalizeWhitespace(job.applyURL) || sourceUrl

  if (!jobId || !sourceUrl) return null

  return {
    title: normalizeWhitespace(job.title),
    company: 'FedEx',
    department: normalizeWhitespace(job.brandName),
    location: toLocation(location),
    city: normalizeWhitespace(location.city),
    country: toCountry(location),
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl,
    employmentType: toEmploymentType(job.employmentType),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeDate(customFieldMap.cf_effective_date),
    closingDate: null,
    jobDescription: null,
    remoteStatus: toRemoteStatus(job, location),
    compensation: toCompensation(customFieldMap),
  }
}

export const buildSearchUrl = ({ page = 1 } = {}) => {
  const normalizedPage = Math.max(1, Number(page) || 1)

  if (normalizedPage === 1) {
    return `${BASE_URL}/jobs?${COUNTRY_FILTER_QUERY}`
  }

  return `${BASE_URL}/jobs/page/${normalizedPage}?${COUNTRY_FILTER_QUERY}`
}

export const extractPreloadState = (html) => {
  try {
    return readParadoxPreload(html)
  } catch {
    return null
  }
}

export const extractSearchResults = (html) => {
  const jobs = extractPreloadState(html)?.jobSearch?.jobs

  return (Array.isArray(jobs) ? jobs : [])
    .map((job) => toJob(job))
    .filter(Boolean)
}

export const extractPaginationSummary = (html) => {
  const jobSearch = extractPreloadState(html)?.jobSearch || {}
  const totalJob = Number(jobSearch.totalJob)
  const currentPage = Math.max(1, Number(jobSearch?.params?.page_number) || 1)

  return {
    currentPage,
    totalPages: Number.isFinite(totalJob) && totalJob > 0
      ? Math.ceil(totalJob / DEFAULT_PAGE_SIZE)
      : null,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'fedex-html',
  timeoutMs: 15000,
})

export const createFedExScraper = ({
  maxPages = Number.isInteger(config.maxPages) ? config.maxPages : 1,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const jobs = []
    const seenJobIds = new Set()

    for (let page = 1; page <= maxPages; page += 1) {
      const html = await fetchText(buildSearchUrl({ page }))
      const pageJobs = extractSearchResults(html)
      const summary = extractPaginationSummary(html)

      for (const job of pageJobs) {
        if (seenJobIds.has(job.jobId)) continue
        seenJobIds.add(job.jobId)

        jobs.push({
          ...job,
          source: 'fedex',
          link: job.applyUrl || job.sourceUrl,
          scrapedAt: new Date().toISOString(),
        })

        if (maxJobs && jobs.length >= maxJobs) {
          return jobs
        }
      }

      if (pageJobs.length === 0) break
      if (summary.totalPages && page >= summary.totalPages) break
    }

    return jobs
  },
})

// Keep the archived fixture helpers exported; registered collection hydrates
// current native role details and reconciles the closing inventory.
export const run = async (options = {}) => createParadoxPublicScraper('fedex').run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running FedEx scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'fedex')
    console.log('DB result:', result)
    process.exit(0)
  }
}
