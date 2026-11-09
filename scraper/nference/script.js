import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { NFERENCE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = NFERENCE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const OFFICIAL_CAREERS_HANDOFF_URL = PROVIDER_METADATA.officialCareersHandoffUrl
export const CAREER_PORTAL_INFO_URL = PROVIDER_METADATA.careerPortalInfoUrl
export const ACTIVE_JOBS_URL = PROVIDER_METADATA.activeJobsApiUrl
export const EXPECTED_IDENTIFIER = PROVIDER_METADATA.kekaIdentifier
export const EXPECTED_KEKA_DOMAIN = PROVIDER_METADATA.kekaDomain
export const EXPECTED_PORTAL_NAME = PROVIDER_METADATA.kekaPortalName
export const EXPECTED_PORTAL_BRAND = PROVIDER_METADATA.kekaPortalBrand
export const EXPECTED_PORTAL_DOMAIN = PROVIDER_METADATA.kekaPortalDomain
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

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

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/section|\/article|\/li|\/ul|\/ol|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<(p|div|section|article|li|ul|ol|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeDomain = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return normalized.endsWith('/') ? normalized : `${normalized}/`
}

const normalizeComparableUrl = (value) => {
  try {
    return new URL(String(value ?? '')).toString().replace(/\/+$/, '')
  } catch {
    return null
  }
}

const parseQuotedConfigValue = (block, key) => {
  const match = String(block ?? '').match(new RegExp(`${key}\\s*:\\s*['"]([^'"]+)['"]`, 'i'))
  return normalizeWhitespace(match?.[1] ?? null)
}

export const extractOfficialKekaHandoffUrl = (html) => {
  const match = String(html ?? '').match(/https:\/\/nference\.keka\.com\/careers\/?/i)
  return normalizeDomain(match?.[0] ?? null)
}

export const hasOfficialCareersSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /<title[^>]*>\s*nference\s*\|\s*careers\s*<\/title>/i.test(rawHtml)
    && normalized.includes('nference India')
    && /Make an Impact/i.test(rawHtml)
    && /advanced AI-based solutions in healthcare diagnostics and therapeutics/i.test(rawHtml)
    && extractOfficialKekaHandoffUrl(rawHtml) === OFFICIAL_CAREERS_HANDOFF_URL
}

export const extractEmbeddedCareersDocumentPath = (html) =>
  String(html ?? '').match(/fetch\(['"]([^'"]+careerportal\/[^'"]+\.html)['"]\)/i)?.[1] ?? null

export const extractCareerConfig = (html) => {
  const configBlock = String(html ?? '').match(/window\.khConfig\s*=\s*\{([\s\S]*?)\}\s*;?/i)?.[1]
  if (!configBlock) return null

  const identifier = parseQuotedConfigValue(configBlock, 'identifier')
  const domain = normalizeDomain(parseQuotedConfigValue(configBlock, 'domain'))
  const portalName = parseQuotedConfigValue(configBlock, 'portalName') || EXPECTED_PORTAL_NAME

  if (!identifier || !domain) return null

  return { identifier, domain, portalName }
}

export const buildCareerPortalInfoUrl = ({ domain, portalName = EXPECTED_PORTAL_NAME } = {}) => {
  const normalizedDomain = normalizeDomain(domain)
  if (!normalizedDomain) return null
  return `${normalizedDomain}api/organization/${portalName}/careerportalinfo`
}

export const buildActiveJobsUrl = ({ domain, identifier, portalName = EXPECTED_PORTAL_NAME } = {}) => {
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
  const normalizedPortalDomain = String(payload?.careersPortalDomain ?? '').trim().toLowerCase()

  return normalizedName === EXPECTED_PORTAL_BRAND
    && normalizedShortName === EXPECTED_PORTAL_BRAND
    && normalizedPortalDomain === EXPECTED_PORTAL_DOMAIN
}

const isIndiaLocation = (location = {}) => {
  if (String(location.countryCode ?? '').toUpperCase() === 'IN') return true
  if (/india/i.test(String(location.countryName ?? ''))) return true
  return /india/i.test([location.name, location.city, location.state].filter(Boolean).join(' '))
}

const normalizePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

const toEmploymentType = (jobType) => (jobType === 2 || jobType === '2' ? 'Full Time' : null)

const mapJob = (job, { domain } = {}) => {
  const locations = Array.isArray(job?.jobLocations) ? job.jobLocations : []
  const location = locations.find(isIndiaLocation)
  const jobId = normalizeWhitespace(job?.id)
  const title = normalizeWhitespace(job?.title)

  if (!location || !jobId || !title) return null

  const city = normalizeWhitespace(location.city) || normalizeWhitespace(location.name)
  const state = normalizeWhitespace(location.state)
  const locationLabel = [city, state, 'India']
    .filter((part, index, values) => part && values.indexOf(part) === index)
    .join(', ')
  const sourceUrl = buildJobDetailUrl({ domain, jobId })
  const applyUrl = buildApplyUrl({ domain, jobId })

  if (!sourceUrl || !applyUrl) return null

  return {
    title,
    company: COMPANY_NAME,
    department: normalizeWhitespace(job?.departmentName),
    location: locationLabel || 'India',
    city,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl,
    employmentType: toEmploymentType(job?.jobType),
    experienceRequired: normalizeWhitespace(job?.experience),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: Array.isArray(job?.skillNames)
      ? job.skillNames.map((skill) => normalizeWhitespace(skill)).filter(Boolean)
      : [],
    postingDate: normalizePostingDate(job?.publishedOn),
    closingDate: null,
    jobDescription: stripTags(job?.description),
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
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createNferenceScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (
      !hasOfficialCareersSignal(careersHtml)
      || extractOfficialKekaHandoffUrl(careersHtml) !== OFFICIAL_CAREERS_HANDOFF_URL
    ) {
      throw new Error('Nference verified first-party careers page no longer matches the trusted public handoff')
    }

    const kekaShellHtml = await fetchText(OFFICIAL_CAREERS_HANDOFF_URL)
    const embeddedDocumentPath = extractEmbeddedCareersDocumentPath(kekaShellHtml)
    if (!embeddedDocumentPath) {
      throw new Error('Nference verified Keka job surface changed materially')
    }

    const embeddedCareersUrl = new URL(embeddedDocumentPath, OFFICIAL_CAREERS_HANDOFF_URL).toString()
    const embeddedCareersHtml = await fetchText(embeddedCareersUrl)
    const careerConfig = extractCareerConfig(embeddedCareersHtml)

    if (
      !careerConfig
      || careerConfig.identifier !== EXPECTED_IDENTIFIER
      || careerConfig.domain !== EXPECTED_KEKA_DOMAIN
      || careerConfig.portalName !== EXPECTED_PORTAL_NAME
    ) {
      throw new Error('Nference verified Keka job surface changed materially')
    }

    if (
      buildCareerPortalInfoUrl(careerConfig) !== CAREER_PORTAL_INFO_URL
      || buildActiveJobsUrl(careerConfig) !== ACTIVE_JOBS_URL
    ) {
      throw new Error('Nference verified Keka job surface changed materially')
    }

    const portalInfo = await fetchJson(CAREER_PORTAL_INFO_URL)
    if (!hasExpectedPortalIdentity(portalInfo)) {
      throw new Error('Nference verified Keka surface no longer matches the exact company identity')
    }

    const jobs = extractSearchResults(await fetchJson(ACTIVE_JOBS_URL), careerConfig)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createNferenceScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
