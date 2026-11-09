import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { KEKA_TECHNOLOGIES_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const EXPECTED_IDENTIFIER = '24040a7e-a7c5-47a5-9cd5-019962c66385'
export const EXPECTED_PORTAL_SLUG = 'default'
export const EXPECTED_KEKA_DOMAIN = 'https://hr.keka.com/careers/'
export const EXPECTED_PORTAL_NAME = 'Keka Technologies Pvt. Ltd'
export const EXPECTED_PORTAL_DOMAIN = 'hr.keka.com'
export const EXPECTED_COMPANY_WEBSITE = 'https://hr.keka.com/careers'

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

const normalizeExperience = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return /years?/i.test(normalized) ? normalized : `${normalized} years`
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

  return /window\.isCareersPage\s*=\s*true/i.test(page)
    && /content-container/i.test(page)
    && /ats\/documents\/[0-9a-f-]+\/careerportal\/[^'" )]+\.html/i.test(page)
  }

export const extractEmbeddedCareersDocumentPath = (html = '') =>
  String(html ?? '').match(/fetch\(['"]([^'"]+careerportal\/[^'"]+\.html)['"]\)/i)?.[1] ?? null

export const extractCareerConfig = (html = '') => {
  const configBlock = String(html ?? '').match(/window\.khConfig\s*=\s*\{([\s\S]*?)\}\s*;?/i)?.[1]
  if (!configBlock) return null

  const identifier = normalizeWhitespace(parseQuotedConfigValue(configBlock, 'identifier'))
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

export const hasExpectedPortalIdentity = (payload = {}) => {
  const normalizedName = normalizeWhitespace(payload.name)
  const normalizedShortName = normalizeWhitespace(payload.shortName)
  const normalizedPortalDomain = String(payload.careersPortalDomain ?? '').trim().toLowerCase()
  const normalizedCompanyWebsite = normalizeComparableUrl(payload.companyWebsite)

  return normalizedName === EXPECTED_PORTAL_NAME
    && normalizedShortName === EXPECTED_PORTAL_NAME
    && normalizedPortalDomain === EXPECTED_PORTAL_DOMAIN
    && normalizedCompanyWebsite === normalizeComparableUrl(EXPECTED_COMPANY_WEBSITE)
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

const buildLocationLabel = (locations = []) => {
  if (locations.length === 0) return 'India'

  const primaryLocation = locations[0]
  const uniqueNames = [...new Set(
    locations
      .map((location) => normalizeWhitespace(location.city) || normalizeWhitespace(location.name))
      .filter(Boolean),
  )]

  if (uniqueNames.length <= 1) {
    const state = normalizeWhitespace(primaryLocation.state)
    return [uniqueNames[0], state, 'India']
      .filter((part, index, values) => part && values.indexOf(part) === index)
      .join(', ')
  }

  return `${uniqueNames.join(' / ')}, India`
}

const mapJob = (job = {}, { domain } = {}) => {
  const indiaLocations = (Array.isArray(job.jobLocations) ? job.jobLocations : []).filter(isIndiaLocation)
  const jobId = normalizeWhitespace(job.id)
  const title = normalizeWhitespace(job.title)
  const sourceUrl = buildJobDetailUrl({ domain, jobId })
  const applyUrl = buildApplyUrl({ domain, jobId })

  if (indiaLocations.length === 0 || !jobId || !title || !sourceUrl || !applyUrl) {
    return null
  }

  const primaryLocation = indiaLocations[0]
  const city = normalizeWhitespace(primaryLocation.city) || normalizeWhitespace(primaryLocation.name)
  const state = indiaLocations.length === 1 ? normalizeWhitespace(primaryLocation.state) : null

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(job.departmentName),
    location: buildLocationLabel(indiaLocations),
    city,
    state,
    country: 'India',
    jobId,
    requisitionId: normalizeWhitespace(job.jobNumber) || jobId,
    sourceUrl,
    applyUrl,
    employmentType: toEmploymentType(job.jobType),
    experienceRequired: normalizeExperience(job.experience),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: Array.isArray(job.skillNames)
      ? job.skillNames.map((skill) => normalizeWhitespace(skill)).filter(Boolean)
      : [],
    postingDate: normalizePostingDate(job.publishedOn),
    closingDate: null,
    jobDescription: normalizeWhitespace(job.description || job.excerpt),
  }
}

export const extractSearchResults = (payload, { domain } = {}) =>
  (Array.isArray(payload) ? payload : [])
    .map((job) => mapJob(job, { domain }))
    .filter(Boolean)

export const createKekaTechnologiesScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersShellHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersShellHtml)) {
      throw new Error('KEKA TECHNOLOGIES verified careers host no longer matches the trusted Keka surface')
    }

    const embeddedDocumentPath = extractEmbeddedCareersDocumentPath(careersShellHtml)
    if (!embeddedDocumentPath) {
      throw new Error('KEKA TECHNOLOGIES verified Keka surface changed materially')
    }

    const embeddedDocumentUrl = new URL(embeddedDocumentPath, CAREERS_URL).toString()
    const embeddedCareersHtml = await fetchText(embeddedDocumentUrl)
    const careerConfig = extractCareerConfig(embeddedCareersHtml)

    if (
      !careerConfig
      || careerConfig.identifier !== EXPECTED_IDENTIFIER
      || careerConfig.domain !== EXPECTED_KEKA_DOMAIN
      || careerConfig.portalName !== EXPECTED_PORTAL_SLUG
    ) {
      throw new Error('KEKA TECHNOLOGIES verified Keka surface changed materially')
    }

    const careerPortalInfoUrl = buildCareerPortalInfoUrl(careerConfig)
    const activeJobsUrl = buildActiveJobsUrl(careerConfig)
    if (!careerPortalInfoUrl || !activeJobsUrl) {
      throw new Error('Unable to build KEKA TECHNOLOGIES Keka endpoints')
    }

    const portalInfo = await fetchJson(careerPortalInfoUrl)
    if (!hasExpectedPortalIdentity(portalInfo)) {
      throw new Error('KEKA TECHNOLOGIES verified Keka surface no longer matches the exact company identity')
    }

    const jobs = extractSearchResults(await fetchJson(activeJobsUrl), careerConfig)

    return jobs.map((job) => ({
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

export const run = async (options = {}) => createKekaTechnologiesScraper().run(options)

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
