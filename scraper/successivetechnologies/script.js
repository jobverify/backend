import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { SUCCESSIVE_TECHNOLOGIES_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const KEKA_BOARD_URL = PROVIDER_METADATA.jobsBoardUrl
export const EXPECTED_IDENTIFIER = 'a0dbae8a-c880-42dd-8947-466574e4de7d'
export const EXPECTED_PORTAL_SLUG = 'default'
export const EXPECTED_PORTAL_DOMAIN = 'successivesoftware.keka.com'
export const EXPECTED_PORTAL_NAME = 'Successive Technologies Pvt. Ltd.'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
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

  return /Careers at Successive Technologies \| Explore Job Openings Successive Digital/i.test(page)
    && /Loading open positions/i.test(page)
    && /successivesoftware\.keka\.com\/careers\//i.test(page)
    && new RegExp(`api/embedjobs/js/${EXPECTED_IDENTIFIER}`, 'i').test(page)
}

export const extractEmbeddedCareersDocumentPath = (html = '') =>
  String(html ?? '').match(/fetch\(['"]([^'"]+careerportal\/[^'"]+\.html)['"]\)/i)?.[1] ?? null

export const extractCareerConfig = (html = '') => {
  const configBlock = String(html ?? '').match(/window\.khConfig\s*=\s*\{([\s\S]*?)\}\s*<\/script>/i)?.[1] ?? ''
  const domain = normalizeDomain(parseQuotedConfigValue(configBlock, 'domain'))
  const portalName = parseQuotedConfigValue(configBlock, 'portalName') || EXPECTED_PORTAL_SLUG
  const identifier = normalizeWhitespace(
    String(html ?? '').match(/api\/embedjobs\/js\/([0-9a-f-]+)/i)?.[1] ?? null,
  )

  if (!identifier || !domain) return null

  return {
    identifier,
    domain,
    portalName,
  }
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

export const hasExpectedPortalIdentity = (payload = {}) => {
  const normalizedName = normalizeWhitespace(payload.name)
  const normalizedShortName = normalizeWhitespace(payload.shortName)
  const normalizedPortalDomain = String(payload.careersPortalDomain ?? '').trim().toLowerCase()

  return normalizedName === EXPECTED_PORTAL_NAME
    && normalizedShortName === EXPECTED_PORTAL_NAME
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

const mapJob = (job = {}, { domain } = {}) => {
  const locations = Array.isArray(job.jobLocations) ? job.jobLocations : []
  const location = locations.find(isIndiaLocation)
  const jobId = normalizeWhitespace(job.id)
  const title = normalizeWhitespace(job.title)
  const sourceUrl = buildJobDetailUrl({ domain, jobId })
  const applyUrl = buildApplyUrl({ domain, jobId })
  const city = normalizeWhitespace(location?.city) || normalizeWhitespace(location?.name)
  const state = normalizeWhitespace(location?.state)

  if (!location || !jobId || !title || !sourceUrl || !applyUrl) return null

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(job.departmentName),
    location: [city, state, 'India'].filter(Boolean).join(', '),
    city,
    state,
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

export const createSuccessiveTechnologiesScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Successive Technologies verified careers page no longer matches the trusted first-party surface')
    }

    const careerConfig = extractCareerConfig(careersHtml)
    if (
      !careerConfig
      || careerConfig.identifier !== EXPECTED_IDENTIFIER
      || careerConfig.domain !== KEKA_BOARD_URL
      || careerConfig.portalName !== EXPECTED_PORTAL_SLUG
    ) {
      throw new Error('Successive Technologies verified Keka surface changed materially')
    }

    const kekaShellHtml = await fetchText(KEKA_BOARD_URL)
    const embeddedDocumentPath = extractEmbeddedCareersDocumentPath(kekaShellHtml)
    if (!embeddedDocumentPath || !embeddedDocumentPath.includes(EXPECTED_IDENTIFIER)) {
      throw new Error('Successive Technologies verified Keka surface changed materially')
    }

    const careerPortalInfoUrl = buildCareerPortalInfoUrl(careerConfig)
    const activeJobsUrl = buildActiveJobsUrl(careerConfig)
    if (!careerPortalInfoUrl || !activeJobsUrl) {
      throw new Error('Unable to build Successive Technologies Keka endpoints')
    }

    const portalInfo = await fetchJson(careerPortalInfoUrl)
    if (!hasExpectedPortalIdentity(portalInfo)) {
      throw new Error('Successive Technologies verified Keka surface no longer matches the exact company identity')
    }

    const jobs = extractSearchResults(await fetchJson(activeJobsUrl), careerConfig)
    const selectedJobs = Number.isInteger(maxJobs) ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
      companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
    }))
  },
})

export const run = async (options = {}) => createSuccessiveTechnologiesScraper().run(options)

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
