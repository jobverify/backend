import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import GINESYS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = GINESYS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const OPEN_POSITIONS_URL = PROVIDER_METADATA.openPositionsUrl
export const EXTERNAL_HANDOFF_URL = PROVIDER_METADATA.externalHandoffUrl
export const EXPECTED_IDENTIFIER = PROVIDER_METADATA.expectedIdentifier
export const EXPECTED_KEKA_DOMAIN = EXTERNAL_HANDOFF_URL
export const EXPECTED_PORTAL_SLUG = 'default'
export const EXPECTED_PORTAL_NAME = 'Ginni Systems Ltd.'
export const EXPECTED_PORTAL_DOMAIN = 'ginesysone.keka.com'
export const EXPECTED_COMPANY_WEBSITE = 'https://www.ginesys.in'
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

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    return url.toString().replace(/\/+$/, '')
  } catch {
    return null
  }
}

const normalizeDomain = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return normalized.endsWith('/') ? normalized : `${normalized}/`
}

const parseQuotedConfigValue = (block, key) => {
  const match = String(block ?? '').match(new RegExp(`${key}\\s*:\\s*['"]([^'"]+)['"]`, 'i'))
  return normalizeWhitespace(match?.[1])
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: `${SOURCE}-json`,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''
  const links = Array.from(page.matchAll(/href=["']([^"']+)["']/gi))
    .map((match) => normalizeComparableUrl(new URL(match[1], CAREERS_URL).toString()))
    .filter(Boolean)

  return /<title>\s*Careers at Ginesys/i.test(page)
    && normalized.includes('Believe in Yourself. We believe in you')
    && normalized.includes('Open Positions')
    && links.includes(normalizeComparableUrl(OPEN_POSITIONS_URL))
}

export const extractCareerConfig = (html = '') => {
  const configBlock = String(html ?? '').match(/window\.khConfig\s*=\s*\{([\s\S]*?)\}\s*<\/script>/i)?.[1]
  if (!configBlock) return null

  const identifier = parseQuotedConfigValue(configBlock, 'identifier')
  const domain = normalizeDomain(parseQuotedConfigValue(configBlock, 'domain'))
  const portalName = parseQuotedConfigValue(configBlock, 'portalName') || EXPECTED_PORTAL_SLUG

  if (!identifier || !domain) return null

  return { identifier, domain, portalName }
}

export const buildCareerPortalInfoUrl = ({ domain, portalName = EXPECTED_PORTAL_SLUG } = {}) => {
  const normalizedDomain = normalizeDomain(domain)
  if (!normalizedDomain) return null
  return `${normalizedDomain}api/organization/${portalName}/careerportalinfo`
}

export const buildActiveJobsUrl = ({ domain, identifier, portalName = EXPECTED_PORTAL_SLUG } = {}) => {
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
  const normalizedCompanyWebsite = normalizeComparableUrl(payload?.companyWebsite)

  return normalizedName === EXPECTED_PORTAL_NAME
    && normalizedShortName === EXPECTED_PORTAL_NAME
    && normalizedPortalDomain === EXPECTED_PORTAL_DOMAIN
    && (
      normalizedCompanyWebsite == null
      || normalizedCompanyWebsite === normalizeComparableUrl(EXPECTED_COMPANY_WEBSITE)
    )
}

const isIndiaLocation = (location = {}) => String(location.countryCode ?? '').toUpperCase() === 'IN'
  || /india/i.test(String(location.countryName ?? ''))

const normalizePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

const toEmploymentType = (jobType) => (jobType === 2 || jobType === '2' ? 'Full Time' : null)

const mapJob = (job, { domain } = {}, scrapedAt) => {
  const locations = Array.isArray(job?.jobLocations) ? job.jobLocations : []
  const location = locations.find(isIndiaLocation)
  const title = normalizeWhitespace(job?.title)
  const jobId = normalizeWhitespace(job?.id)
  const city = normalizeWhitespace(location?.city) || normalizeWhitespace(location?.name)
  const state = normalizeWhitespace(location?.state)
  const sourceUrl = buildJobDetailUrl({ domain, jobId })
  const applyUrl = buildApplyUrl({ domain, jobId })

  if (!location || !title || !jobId || !sourceUrl || !applyUrl) return null

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(job.departmentName),
    location: [city, state, 'India']
      .filter((part, index, values) => part && values.indexOf(part) === index)
      .join(', '),
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
    requiredSkills: [],
    postingDate: normalizePostingDate(job.publishedOn),
    closingDate: null,
    jobDescription: normalizeWhitespace(job.description),
    remoteStatus: 'On-site',
    source: SOURCE,
    link: applyUrl,
    scrapedAt,
    companyCareerPage: CAREERS_URL,
    companyDomain: PROVIDER_METADATA.companyDomain,
    atsPlatform: PROVIDER_METADATA.atsPlatform,
  }
}

export const extractIndiaJobs = (payload) =>
  (Array.isArray(payload) ? payload : [])
    .map((job) => mapJob(job, { domain: EXTERNAL_HANDOFF_URL }, null))
    .filter(Boolean)

export const createGinesysScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Ginesys careers shell no longer matches the trusted first-party surface')
    }

    const openPositionsHtml = await fetchText(OPEN_POSITIONS_URL)
    const careerConfig = extractCareerConfig(openPositionsHtml)
    if (
      !careerConfig
      || careerConfig.identifier !== EXPECTED_IDENTIFIER
      || careerConfig.domain !== EXPECTED_KEKA_DOMAIN
      || careerConfig.portalName !== EXPECTED_PORTAL_SLUG
    ) {
      throw new Error('The verified Ginesys Keka surface no longer matches the trusted embed contract')
    }

    const portalInfoUrl = buildCareerPortalInfoUrl(careerConfig)
    const activeJobsUrl = buildActiveJobsUrl(careerConfig)
    const portalInfo = await fetchJson(portalInfoUrl)
    if (!hasExpectedPortalIdentity(portalInfo)) {
      throw new Error('The verified Ginesys Keka surface no longer matches the exact company identity')
    }

    const payload = await fetchJson(activeJobsUrl)
    return (Array.isArray(payload) ? payload : [])
      .map((job) => mapJob(job, careerConfig, now()))
      .filter(Boolean)
  },
})

export const run = async (options = {}) => createGinesysScraper(options).run(options)

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
