import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'sisainformationsecurity'
export const COMPANY = 'SISA Information Security'
export const OFFICIAL_CAREERS_URL = 'https://www.sisa.ai/careers'
export const KEKA_CAREER_PAGE_URL = 'https://sisainfosec.keka.com/careers/'
export const EXPECTED_IDENTIFIER = '8740a3ea-613d-40db-9641-e5d4662a22cd'
export const EXPECTED_KEKA_DOMAIN = 'https://sisainfosec.keka.com/careers/'
export const EXPECTED_PORTAL_NAME = 'SISA Information Security Pvt Ltd'

export const PROVIDER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  companyCareerPage: OFFICIAL_CAREERS_URL,
  companyDomain: 'sisa.ai',
  adapter: 'script',
  atsPlatform: 'keka-embed-api',
  modulePath: '../../scraper/sisainformationsecurity/script.js',
  dryRunFile: 'sisainformationsecurity/jobs.json',
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
  return normalizeWhitespace(match?.[1] ?? null)
}

export const extractEmbeddedCareersDocumentPath = (html) =>
  String(html ?? '').match(/\/ats\/documents\/[0-9a-f-]+\/careerportal\/[^"' ]+\.html/i)?.[0] ?? null

export const extractCareerConfig = (html) => {
  const configBlock = String(html ?? '').match(/window\.khConfig\s*=\s*\{([\s\S]*?)\}\s*;?/i)?.[1]
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

export const buildCareerPortalInfoUrl = ({ domain, portalName = 'default' } = {}) => {
  const normalizedDomain = normalizeDomain(domain)
  if (!normalizedDomain) return null
  return `${normalizedDomain}api/organization/${portalName}/careerportalinfo`
}

export const buildActiveJobsUrl = ({ domain, identifier, portalName = 'default' } = {}) => {
  const normalizedDomain = normalizeDomain(domain)
  if (!normalizedDomain || !identifier) return null
  return `${normalizedDomain}api/embedjobs/${portalName}/active/${identifier}`
}

const buildJobDetailUrl = ({ domain, jobId } = {}) => {
  const normalizedDomain = normalizeDomain(domain)
  if (!normalizedDomain || !jobId) return null
  return `${normalizedDomain}jobdetails/${jobId}`
}

const buildApplyUrl = ({ domain, jobId } = {}) => {
  const normalizedDomain = normalizeDomain(domain)
  if (!normalizedDomain || !jobId) return null
  return `${normalizedDomain}applyjob/${jobId}`
}

export const hasExpectedPortalIdentity = (payload) => {
  const normalizedName = normalizeWhitespace(payload?.name)
  const normalizedShortName = normalizeWhitespace(payload?.shortName)
  const normalizedPortalDomain = normalizeWhitespace(payload?.careersPortalDomain)

  return normalizedName === EXPECTED_PORTAL_NAME
    && normalizedShortName === EXPECTED_PORTAL_NAME
    && normalizedPortalDomain === new URL(EXPECTED_KEKA_DOMAIN).hostname
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
  const sourceUrl = buildJobDetailUrl({ domain, jobId })
  const applyUrl = buildApplyUrl({ domain, jobId })

  if (!sourceUrl || !applyUrl) return null

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(job.departmentName),
    location: locationLabel || 'India',
    city,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl,
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
  label: 'sisainformationsecurity-html',
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: 'sisainformationsecurity-json',
  timeoutMs: 15000,
})

export const createSisaInformationSecurityScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson } = {}) {
    const bootstrapHtml = await fetchText(KEKA_CAREER_PAGE_URL)
    const embeddedCareersPath = extractEmbeddedCareersDocumentPath(bootstrapHtml)
    if (!embeddedCareersPath) {
      throw new Error('SISA Information Security Keka careers page no longer exposes the verified embedded careers document')
    }

    const embeddedCareersUrl = new URL(embeddedCareersPath, KEKA_CAREER_PAGE_URL).toString()
    const careerConfig = extractCareerConfig(await fetchText(embeddedCareersUrl))
    if (!careerConfig) {
      throw new Error('SISA Information Security embedded careers document no longer exposes the verified Keka configuration')
    }

    if (
      careerConfig.identifier !== EXPECTED_IDENTIFIER
      || careerConfig.domain !== EXPECTED_KEKA_DOMAIN
      || careerConfig.portalName !== 'default'
    ) {
      throw new Error('SISA Information Security verified Keka job surface changed materially')
    }

    const careerPortalInfoUrl = buildCareerPortalInfoUrl(careerConfig)
    if (!careerPortalInfoUrl) {
      throw new Error('Unable to build SISA Information Security career portal info URL')
    }

    if (!hasExpectedPortalIdentity(await fetchJson(careerPortalInfoUrl))) {
      throw new Error('SISA Information Security exact company identity no longer matches the verified public Keka portal')
    }

    const activeJobsUrl = buildActiveJobsUrl(careerConfig)
    if (!activeJobsUrl) {
      throw new Error('Unable to build SISA Information Security active jobs URL')
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

export const run = async () => createSisaInformationSecurityScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}

