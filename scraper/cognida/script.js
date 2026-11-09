import path from 'path'
import { fileURLToPath } from 'url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://www.cognida.ai/careers/'

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
  const configBlock = String(html ?? '').match(/window\.khConfig\s*=\s*\{([\s\S]*?)\}\s*<\/script>/i)?.[1]
  if (!configBlock) return null

  const identifier = parseQuotedConfigValue(configBlock, 'identifier')
  const domain = normalizeDomain(parseQuotedConfigValue(configBlock, 'domain'))

  if (!identifier || !domain) return null

  return { identifier, domain, portalName: 'default' }
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

const toEmploymentType = (jobType) => (jobType === 2 || jobType === '2' ? 'Full Time' : null)

const inferCountryName = (location = {}) => {
  if (normalizeWhitespace(location.countryName)) return normalizeWhitespace(location.countryName)
  return String(location.countryCode || '').toUpperCase() === 'IN' ? 'India' : null
}

const isIndiaLocation = (location = {}) => inferCountryName(location) === 'India'

const isRemoteLocation = (location = {}) =>
  /remote/i.test(normalizeWhitespace(location.name) || '')
  || /remote/i.test(normalizeWhitespace(location.city) || '')

const toLocationLabel = (location = {}) => {
  const name = normalizeWhitespace(location.name)
  const city = normalizeWhitespace(location.city)
  const parts = []

  if (isRemoteLocation(location)) {
    parts.push('Remote')
    if (city && !/remote/i.test(city)) parts.push(city)
  } else if (name) {
    parts.push(name)
  } else if (city) {
    parts.push(city)
  }

  parts.push('India')
  return parts.join(', ')
}

const normalizePostingDate = (value) => {
  const date = new Date(normalizeWhitespace(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

const mapJob = (job, { kekaDomain }) => {
  const indiaLocations = (Array.isArray(job?.jobLocations) ? job.jobLocations : [])
    .filter(isIndiaLocation)
  const jobId = normalizeWhitespace(job?.id)
  const detailUrl = buildJobDetailUrl({ kekaDomain, jobId })
  if (!jobId || !detailUrl || indiaLocations.length === 0) return null

  const primaryLocation = indiaLocations[0]

  return {
    title: normalizeWhitespace(job.title),
    company: 'Cognida.ai',
    department: normalizeWhitespace(job.departmentName),
    location: toLocationLabel(primaryLocation),
    city: normalizeWhitespace(primaryLocation.city) || normalizeWhitespace(primaryLocation.name),
    country: 'India',
    jobId,
    requisitionId: normalizeWhitespace(job.jobNumber) || jobId,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    employmentType: toEmploymentType(job.jobType),
    experienceRequired: normalizeWhitespace(job.experience),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: Array.isArray(job.skillNames)
      ? job.skillNames.map(normalizeWhitespace).filter(Boolean)
      : [],
    postingDate: normalizePostingDate(job.publishedOn),
    closingDate: null,
    jobDescription: normalizeWhitespace(job.description),
    remoteStatus: indiaLocations.some(isRemoteLocation) ? 'Remote' : 'On-site',
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
  label: 'cognida-html',
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: 'cognida-json',
  timeoutMs: 15000,
})

export const createCognidaScraper = () => ({
  async run(options = {}) {
    const careerConfig = extractCareerConfig(await (options.fetchText || defaultFetchText)(CAREER_PAGE_URL))
    if (!careerConfig) throw new Error('Unable to resolve Cognida Keka embed configuration')

    const activeJobsUrl = buildActiveJobsUrl(careerConfig)
    if (!activeJobsUrl) throw new Error('Unable to build Cognida active jobs URL')

    const jobs = extractSearchResults(
      await (options.fetchJson || defaultFetchJson)(activeJobsUrl),
      { kekaDomain: careerConfig.domain },
    )

    return jobs.map((job) => ({
      ...job,
      source: 'cognida',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createCognidaScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  console.log(`Total India jobs scraped: ${jobs.length}`)
  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'cognida')
  }
}
