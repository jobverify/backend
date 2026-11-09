import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://www.bhanzu.com/careers'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeDomain = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return normalized.endsWith('/') ? normalized : `${normalized}/`
}

const parseQuotedConfigValue = (block, key) => {
  const match = String(block ?? '').match(new RegExp(`${key}\\s*:\\s*['"]([^'"]+)['"]`, 'i'))
  return normalizeWhitespace(match?.[1] || null)
}

export const extractCareerConfig = (html) => {
  const configBlock = String(html ?? '').match(/window\.khConfig\s*=\s*\{([\s\S]*?)\}\s*;/i)?.[1]
  if (!configBlock) return null

  const identifier = parseQuotedConfigValue(configBlock, 'identifier')
  const domain = normalizeDomain(parseQuotedConfigValue(configBlock, 'domain'))

  if (!identifier || !domain) return null

  return {
    identifier,
    domain,
    portalName: 'default',
  }
}

export const buildActiveJobsUrl = ({ domain, identifier, portalName = 'default' } = {}) => {
  const normalizedDomain = normalizeDomain(domain)
  if (!normalizedDomain || !identifier) return null
  return `${normalizedDomain}api/embedjobs/${portalName}/active/${identifier}`
}

const buildJobDetailUrl = ({ kekaDomain, jobId } = {}) => {
  const normalizedDomain = normalizeDomain(kekaDomain)
  if (!normalizedDomain || !jobId) return null
  return `${normalizedDomain}jobdetails/${jobId}`
}

const toEmploymentType = (jobType) => {
  if (jobType === 1 || jobType === '1') return null
  if (jobType === 2 || jobType === '2') return 'Full Time'
  return null
}

const inferCountryName = (location = {}) => {
  if (normalizeWhitespace(location.countryName)) return normalizeWhitespace(location.countryName)
  if (String(location.countryCode || '').toUpperCase() === 'IN') return 'India'
  if (
    /india/i.test(String(location.name || ''))
    || /india/i.test(String(location.city || ''))
    || /india/i.test(String(location.state || ''))
  ) {
    return 'India'
  }
  return null
}

const isRemoteLocation = (location = {}) =>
  /remote/i.test(normalizeWhitespace(location.name) || '')
  || /remote/i.test(normalizeWhitespace(location.city) || '')

const isIndiaLikeLocation = (location = {}) => {
  const countryName = inferCountryName(location)
  if (countryName === 'India') return true

  if (normalizeWhitespace(location.countryName)) return false

  return Boolean(normalizeWhitespace(location.city) || normalizeWhitespace(location.state))
}

const toLocationLabel = (location = {}) => {
  const name = normalizeWhitespace(location.name)
  const city = normalizeWhitespace(location.city)
  const country = inferCountryName(location) || (isIndiaLikeLocation(location) ? 'India' : null)
  const parts = []

  if (isRemoteLocation(location)) {
    parts.push('Remote')
    if (city && !/remote/i.test(city)) parts.push(city)
  } else if (name) {
    parts.push(name)
  } else if (city) {
    parts.push(city)
  }

  if (country && !parts.includes(country)) parts.push(country)

  return parts.join(', ') || null
}

const extractPrimaryCity = (locations) => {
  for (const location of locations) {
    const city = normalizeWhitespace(location.city)
    if (city && !/remote/i.test(city)) return city
  }

  for (const location of locations) {
    const name = normalizeWhitespace(location.name)
    if (name && !/remote/i.test(name)) return name
  }

  return null
}

const inferRemoteStatus = (locations) =>
  locations.some((location) => isRemoteLocation(location)) ? 'Remote' : 'On-site'

const normalizePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

const mapJob = (job, { kekaDomain }) => {
  const locations = Array.isArray(job?.jobLocations) ? job.jobLocations : []
  const indiaLocations = locations.filter((location) => isIndiaLikeLocation(location))
  if (indiaLocations.length === 0) return null

  const jobId = normalizeWhitespace(job?.id)
  const detailUrl = buildJobDetailUrl({ kekaDomain, jobId })
  if (!jobId || !detailUrl) return null

  return {
    title: normalizeWhitespace(job.title),
    company: 'Bhanzu',
    department: normalizeWhitespace(job.departmentName),
    location: toLocationLabel(indiaLocations[0]),
    city: extractPrimaryCity(indiaLocations),
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    employmentType: toEmploymentType(job.jobType),
    experienceRequired: normalizeWhitespace(job.experience),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: Array.isArray(job.skillNames)
      ? job.skillNames.map((skill) => normalizeWhitespace(skill)).filter(Boolean)
      : [],
    postingDate: normalizePostingDate(job.publishedOn),
    closingDate: null,
    jobDescription: normalizeWhitespace(job.description),
    remoteStatus: inferRemoteStatus(indiaLocations),
    compensation: normalizeWhitespace(job.salaryRangeFormat),
  }
}

export const extractSearchResults = (payload, { kekaDomain } = {}) =>
  (Array.isArray(payload) ? payload : [])
    .map((job) => mapJob(job, { kekaDomain }))
    .filter(Boolean)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'bhanzu-html',
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: 'bhanzu-json',
  timeoutMs: 15000,
})

export const createBhanzuScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const fetchJson = options.fetchJson || defaultFetchJson

    const careerPageHtml = await fetchText(CAREER_PAGE_URL)
    const careerConfig = extractCareerConfig(careerPageHtml)
    if (!careerConfig) {
      throw new Error('Unable to resolve Bhanzu Keka embed configuration')
    }

    const activeJobsUrl = buildActiveJobsUrl(careerConfig)
    if (!activeJobsUrl) {
      throw new Error('Unable to build Bhanzu active jobs URL')
    }

    const payload = await fetchJson(activeJobsUrl)
    const jobs = extractSearchResults(payload, { kekaDomain: careerConfig.domain })
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: 'bhanzu',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createBhanzuScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Bhanzu scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'bhanzu')
    console.log('DB result:', result)
    process.exit(0)
  }
}
