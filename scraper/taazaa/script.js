import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { TAAZAA_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const KEKA_BOARD_URL = PROVIDER_METADATA.officialKekaBoardUrl
export const CAREER_PORTAL_INFO_URL = `${KEKA_BOARD_URL}api/organization/default/careerportalinfo`
export const ACTIVE_JOBS_URL = `${KEKA_BOARD_URL}api/jobs/default/active`
export const EXPECTED_IDENTIFIER = PROVIDER_METADATA.expectedIdentifier
export const EXPECTED_KEKA_DOMAIN = 'taazaa.keka.com'
export const EXPECTED_PORTAL_NAME = 'Taazaa'

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

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  return /Software Engineering &amp; AI Jobs at Taazaa \| Open Positions/i.test(page)
    && /Current Openings/i.test(page)
    && /View All Openings/i.test(page)
    && /hr@taazaa\.com/i.test(page)
}

const parseQuotedConfigValue = (block, key) => {
  const match = String(block ?? '').match(new RegExp(`${key}\\s*:\\s*['"]([^'"]+)['"]`, 'i'))
  return normalizeWhitespace(match?.[1] || null)
}

export const extractCareerConfig = (html = '') => {
  const configBlock = String(html ?? '').match(/khConfig\s*=\s*\{([\s\S]*?)\}\s*<\/script>/i)?.[1]
  if (!configBlock) return null

  const identifier = parseQuotedConfigValue(configBlock, 'identifier')
  const domain = normalizeDomain(parseQuotedConfigValue(configBlock, 'domain'))
  const portalName = parseQuotedConfigValue(configBlock, 'portalName') || 'default'

  if (!identifier || !domain) return null

  return {
    identifier,
    domain,
    portalName,
  }
}

export const hasExpectedPortalIdentity = (payload = {}) => {
  const name = normalizeWhitespace(payload?.name)?.trim()
  const shortName = normalizeWhitespace(payload?.shortName)?.trim()
  const domain = normalizeWhitespace(payload?.careersPortalDomain)?.trim()

  return name === EXPECTED_PORTAL_NAME
    && shortName === EXPECTED_PORTAL_NAME
    && domain === EXPECTED_KEKA_DOMAIN
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
  const locations = Array.isArray(job?.jobLocations) ? job.jobLocations : []
  const location = locations.find(isIndiaLocation)
  const jobId = normalizeWhitespace(job?.id)
  const title = normalizeWhitespace(job?.title)
  const sourceUrl = buildJobDetailUrl({ domain, jobId })
  const applyUrl = buildApplyUrl({ domain, jobId })

  if (!location || !jobId || !title || !sourceUrl || !applyUrl) return null

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(job.departmentName),
    location: [normalizeWhitespace(location.city) || normalizeWhitespace(location.name), normalizeWhitespace(location.state), 'India']
      .filter(Boolean)
      .join(', '),
    city: normalizeWhitespace(location.city) || normalizeWhitespace(location.name),
    country: 'India',
    jobId,
    requisitionId: normalizeWhitespace(job.jobNumber) || jobId,
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

export const createTaazaaScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson, now = () => new Date().toISOString() } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Taazaa verified first-party careers page changed materially')
    }

    const careerConfig = extractCareerConfig(careersHtml)
    if (
      !careerConfig
      || careerConfig.identifier !== EXPECTED_IDENTIFIER
      || careerConfig.domain !== KEKA_BOARD_URL
    ) {
      throw new Error('Taazaa verified Keka embed configuration changed materially')
    }

    const portalInfo = await fetchJson(CAREER_PORTAL_INFO_URL)
    if (!hasExpectedPortalIdentity(portalInfo)) {
      throw new Error('Taazaa Keka portal no longer resolves to the exact company identity')
    }

    const jobs = extractSearchResults(await fetchJson(ACTIVE_JOBS_URL), { domain: careerConfig.domain })

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createTaazaaScraper().run(options)

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
