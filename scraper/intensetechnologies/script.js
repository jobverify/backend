import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserNetworkFallback } from '../../scraper-support/shared/browserNetworkFallback.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { INTENSE_TECHNOLOGIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = INTENSE_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const CAREER_PORTAL_INFO_URL = PROVIDER_METADATA.careerPortalInfoUrl
export const EXPECTED_KEKA_DOMAIN = PROVIDER_METADATA.expectedKekaDomain
export const EXPECTED_IDENTIFIER = PROVIDER_METADATA.expectedIdentifier
export const EXPECTED_CAREERS_PORTAL_DOMAIN = 'intense.keka.com'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#8211;|&#x2013;|&ndash;/gi, '-')
  .replace(/&#8212;|&#x2014;|&mdash;/gi, '-')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtml(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripHtml = (value) => normalizeWhitespace(
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

const parseQuotedConfigValue = (block, key) => {
  const match = String(block ?? '').match(new RegExp(`${key}\\s*:\\s*['"]([^'"]+)['"]`, 'i'))
  return normalizeWhitespace(match?.[1] ?? null)
}

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    return url.toString().replace(/\/+$/, '')
  } catch {
    return null
  }
}

export const hasVerifiedCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)?.toLowerCase() || ''
  const hasCanonicalLink =
    /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.in10stech\.com\/careers["']/i.test(page)
    || /<link[^>]+href=["']https:\/\/www\.in10stech\.com\/careers["'][^>]+rel=["']canonical["']/i.test(page)

  return /<title[^>]*>\s*careers\s*<\/title>/i.test(page)
    && hasCanonicalLink
    && /window\.khConfig/i.test(page)
    && /https:\/\/intense\.keka\.com\/careers\/api\/embedjobs\/js\/fcf90e1b-bb0a-4d66-b896-6b0de9cf0dce/i.test(page)
    && normalized.includes('deliver impact at work and beyond')
    && normalized.includes('open positions')
}

export const extractCareerConfig = (html = '') => {
  const page = String(html ?? '')
  const configBlock = page.match(/window\.khConfig\s*=\s*([\s\S]*?)<\/script>/i)?.[1] ?? ''
  const source = configBlock || page

  const identifier = parseQuotedConfigValue(source, 'identifier')
  const domain = normalizeDomain(parseQuotedConfigValue(source, 'domain'))
  const portalName = parseQuotedConfigValue(source, 'portalName') || 'default'

  if (!identifier || !domain) return null

  return {
    identifier,
    domain,
    portalName,
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

export const hasExpectedCareerPortalInfo = (payload = {}) => {
  const filters = Array.isArray(payload?.jobListingSetting?.filters) ? payload.jobListingSetting.filters : []

  return normalizeWhitespace(payload?.name) === COMPANY
    && normalizeWhitespace(payload?.shortName) === COMPANY
    && String(payload?.careersPortalDomain ?? '').trim().toLowerCase() === EXPECTED_CAREERS_PORTAL_DOMAIN
    && normalizeWhitespace(payload?.jobListingSetting?.groupBy) === 'department'
    && filters.includes('department')
    && filters.includes('location')
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

const toRemoteStatus = (job = {}, location = {}) => {
  const combined = [
    job.title,
    job.description,
    location.name,
    location.city,
    location.state,
  ].filter(Boolean).join(' ').toLowerCase()

  if (combined.includes('remote')) return 'Remote'
  if (combined.includes('hybrid')) return 'Hybrid'
  return 'On-site'
}

const toLocationLabel = (location = {}) => {
  const city = normalizeWhitespace(location.city) || normalizeWhitespace(location.name)
  const state = normalizeWhitespace(location.state)

  return [city, state, 'India']
    .filter((part, index, values) => part && values.indexOf(part) === index)
    .join(', ')
}

export const extractSearchResults = (payload, { domain } = {}) =>
  (Array.isArray(payload) ? payload : [])
    .map((job) => {
      const indiaLocations = (Array.isArray(job?.jobLocations) ? job.jobLocations : [])
        .filter(isIndiaLocation)
      const location = indiaLocations[0]
      const jobId = normalizeWhitespace(job?.id)
      const title = normalizeWhitespace(job?.title)
      const sourceUrl = buildJobDetailUrl({ domain, jobId })
      const applyUrl = buildApplyUrl({ domain, jobId })

      if (!location || !jobId || !title || !sourceUrl || !applyUrl) {
        return null
      }

      const city = normalizeWhitespace(location.city) || normalizeWhitespace(location.name)

      return {
        title,
        company: COMPANY,
        department: normalizeWhitespace(job.departmentName),
        location: toLocationLabel(location) || 'India',
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
        jobDescription: stripHtml(job.description) || normalizeWhitespace(job.excerpt),
        remoteStatus: toRemoteStatus(job, location),
      }
    })
    .filter(Boolean)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 30000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: SOURCE,
  timeoutMs: 30000,
})

export const createIntenseTechnologiesScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    fetchBrowserText,
    fetchBrowserJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const browserFallback = createBrowserNetworkFallback({
      fetchText,
      fetchJson,
      fetchBrowserText,
      fetchBrowserJson,
      userAgent: USER_AGENT,
      browserSessionOptions: {
        timeoutMs: 90000,
        settleTimeMs: 12000,
        ignoreHTTPSErrors: false,
      },
    })

    try {
      const careersHtml = await browserFallback.fetchText(CAREERS_URL)
      if (!hasVerifiedCareersPageSignal(careersHtml)) {
        throw new Error('Intense Technologies verified first-party careers page no longer matches the known public shell')
      }

      const careerConfig = extractCareerConfig(careersHtml)
      if (
        !careerConfig
        || careerConfig.identifier !== EXPECTED_IDENTIFIER
        || careerConfig.domain !== EXPECTED_KEKA_DOMAIN
      ) {
        throw new Error('Intense Technologies verified first-party careers page no longer matches the known public shell')
      }

      const careerPortalInfoUrl = buildCareerPortalInfoUrl(careerConfig)
      const activeJobsUrl = buildActiveJobsUrl(careerConfig)
      if (!careerPortalInfoUrl || !activeJobsUrl) {
        throw new Error('Unable to build Intense Technologies Keka endpoints')
      }

      const portalInfo = await browserFallback.fetchJson(careerPortalInfoUrl)
      if (!hasExpectedCareerPortalInfo(portalInfo)) {
        throw new Error('Intense Technologies verified Keka portal identity no longer matches the exact company surface')
      }

      const jobs = extractSearchResults(await browserFallback.fetchJson(activeJobsUrl), careerConfig)
      const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

      return selectedJobs.map((job) => ({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: now(),
      }))
    } finally {
      await browserFallback.close()
    }
  },
})

export const run = async (options = {}) => createIntenseTechnologiesScraper().run(options)

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
