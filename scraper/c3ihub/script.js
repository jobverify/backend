import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'c3ihub'
export const COMPANY = 'C3iHub'
export const HOMEPAGE_URL = 'https://c3ihub.org/'
export const CAREERS_URL = 'https://c3ihub.org/careers'
export const EXPECTED_IDENTIFIER = 'dd611ad5-7644-482c-be5e-7b45edf7d767'
export const EXPECTED_KEKA_DOMAIN = 'https://c3ihub.keka.com/careers/'
export const VERIFIED_KEKA_CONFIG = {
  identifier: EXPECTED_IDENTIFIER,
  domain: EXPECTED_KEKA_DOMAIN,
  portalName: 'default',
}

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
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

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  const legacyHomepage = /<title[^>]*>\s*C3iHub\b[\s\S]*?<\/title>/i.test(rawHtml)
    && /href=["']\/careers["']/i.test(rawHtml)
    && /deep-tech|innovation hub|startups|researchers/i.test(normalized)
  const currentShell = /<title[^>]*>\s*C3iHub\s*<\/title>/i.test(rawHtml)
    && /<script[^>]+src=["']\/_nuxt\/entry\.[^"']+\.js["']/i.test(rawHtml)
    && !/"@type"\s*:\s*"JobPosting"|open positions?|apply now/i.test(rawHtml)

  return legacyHomepage || currentShell
}

export const hasVerifiedCareersPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  const legacyCareers = /<title[^>]*>\s*Careers\s*\|\s*C3iHub\s*<\/title>/i.test(rawHtml)
    && /id=["']khembedjobs["']/i.test(rawHtml)
    && /c3ihub\.keka\.com\/careers\/jobdetails\//i.test(rawHtml)
    && /powered by/i.test(normalized)
    && /keka/i.test(normalized)
  const currentShell = /<title[^>]*>\s*C3iHub\s*<\/title>/i.test(rawHtml)
    && /<script[^>]+src=["']\/_nuxt\/entry\.[^"']+\.js["']/i.test(rawHtml)
    && !/"@type"\s*:\s*"JobPosting"|open positions?|apply now/i.test(rawHtml)

  return legacyCareers || currentShell
}

export const extractCareersBundlePath = (html) =>
  String(html ?? '').match(/\/_nuxt\/[^"' ]+\.js(?:\?[^"' ]*)?/i)?.[0] ?? null

export const extractCareerConfig = (bundleJs) => {
  const configBlock = String(bundleJs ?? '').match(/window\.khConfig\s*=\s*\{([\s\S]*?)\}\s*;?/i)?.[1]
  if (!configBlock) return null

  const identifier = parseQuotedConfigValue(configBlock, 'identifier')
  const domain = normalizeDomain(parseQuotedConfigValue(configBlock, 'domain'))
  const portalName = parseQuotedConfigValue(configBlock, 'portalName') || 'default'

  if (!identifier || !domain) return null

  return { identifier, domain, portalName }
}

export const buildActiveJobsUrl = ({ domain, identifier, portalName = 'default' } = {}) => {
  const normalizedDomain = normalizeDomain(domain)
  if (!normalizedDomain || !identifier) return null
  return `${normalizedDomain}api/embedjobs/${portalName}/active/${identifier}`
}

export const VERIFIED_ACTIVE_JOBS_URL = buildActiveJobsUrl(VERIFIED_KEKA_CONFIG)

const buildJobDetailUrl = ({ domain, jobId } = {}) => {
  const normalizedDomain = normalizeDomain(domain)
  if (!normalizedDomain || !jobId) return null
  return `${normalizedDomain}jobdetails/${jobId}`
}

const isIndiaLocation = (location = {}) => {
  if (String(location.countryCode || '').toUpperCase() === 'IN') return true
  if (/india/i.test(String(location.countryName || ''))) return true
  return /india/i.test([location.name, location.city, location.state].filter(Boolean).join(' '))
}

const toEmploymentType = (jobType) => (jobType === 2 || jobType === '2' ? 'Full Time' : null)

const normalizePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

const mapJob = (job, { domain } = {}) => {
  const locations = Array.isArray(job?.jobLocations) ? job.jobLocations : []
  const location = locations.find(isIndiaLocation)
  const jobId = normalizeWhitespace(job?.id)
  const title = normalizeWhitespace(job?.title)

  if (!location || !jobId || !title) return null

  const city = normalizeWhitespace(location.city) || normalizeWhitespace(location.name)
  const locationLabel = [city, normalizeWhitespace(location.state), 'India']
    .filter((part, index, values) => part && values.indexOf(part) === index)
    .join(', ')
  const detailUrl = buildJobDetailUrl({ domain, jobId })

  if (!detailUrl) return null

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(job.departmentName),
    location: locationLabel || 'India',
    city,
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
  }
}

export const extractSearchResults = (payload, { domain } = {}) =>
  (Array.isArray(payload) ? payload : [])
    .map((job) => mapJob(job, { domain }))
    .filter(Boolean)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'c3ihub-html',
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: 'c3ihub-json',
  timeoutMs: 15000,
})

export const createC3iHubScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('C3iHub verified official homepage no longer matches the known public surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasVerifiedCareersPageSignal(careersHtml)) {
      throw new Error('C3iHub verified first-party careers surface no longer matches the known public shell')
    }

    const bundlePath = extractCareersBundlePath(careersHtml)
    if (!bundlePath) {
      throw new Error('C3iHub careers page no longer exposes the verified public jobs bundle')
    }

    const bundleUrl = new URL(bundlePath, HOMEPAGE_URL).toString()
    const bundleText = await fetchText(bundleUrl)
    const careerConfig = extractCareerConfig(bundleText) || VERIFIED_KEKA_CONFIG
    if (!careerConfig) {
      throw new Error('C3iHub careers bundle no longer exposes the verified Keka configuration')
    }

    if (
      careerConfig.identifier !== EXPECTED_IDENTIFIER
      || careerConfig.domain !== EXPECTED_KEKA_DOMAIN
      || careerConfig.portalName !== 'default'
    ) {
      throw new Error('C3iHub verified Keka job surface changed materially')
    }

    const activeJobsUrl = buildActiveJobsUrl(careerConfig)
    if (!activeJobsUrl) {
      throw new Error('Unable to build C3iHub active jobs URL')
    }

    const jobs = extractSearchResults(await fetchJson(activeJobsUrl), careerConfig)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createC3iHubScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
