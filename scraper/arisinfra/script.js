import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ARISINFRA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = ARISINFRA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const SITEMAP_URL = PROVIDER_METADATA.sitemapUrl
export const CAREER_PORTAL_INFO_URL = PROVIDER_METADATA.careerPortalInfoUrl
export const EXPECTED_KEKA_DOMAIN = PROVIDER_METADATA.expectedKekaDomain
export const EXPECTED_IDENTIFIER = PROVIDER_METADATA.expectedIdentifier
export const EXPECTED_CAREERS_PORTAL_DOMAIN = 'arisinfra.keka.com'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#8211;|&#x2013;|&ndash;/gi, '-')
  .replace(/&#8212;|&#x2014;|&mdash;/gi, '-')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
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

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const sameUrl = (left, right) => normalizeComparableUrl(left) === normalizeComparableUrl(right)

const parseQuotedConfigValue = (block, key) => {
  const match = String(block ?? '').match(new RegExp(`${key}\\s*:\\s*['"]([^'"]+)['"]`, 'i'))
  return normalizeWhitespace(match?.[1] || null)
}

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1]) || null
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    json: await response.json(),
  }
}

export const hasOfficialHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)?.toLowerCase() || ''

  return extractTitle(rawHtml) === 'ArisInfra - The Future of Construction Materials'
    && /href=["'][^"']*pages\/careers["']/i.test(rawHtml)
    && /href=["'][^"']*pages\/investor-relations["']/i.test(rawHtml)
    && normalized.includes('one network')
    && normalized.includes('simplifying construction')
    && /(?:delivery\.arisinfra\.com|connect\.aris\.in)\/privacy-policy/i.test(rawHtml)
}

export const hasVerifiedCareersPageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)?.toLowerCase() || ''

  return extractTitle(rawHtml) === 'ArisInfra - Simplifying Construction'
    && /id=["']jobview["']/i.test(rawHtml)
    && /window\.khConfig\s*=\s*\{/i.test(rawHtml)
    && /https:\/\/arisinfra\.keka\.com\/careers\/api\/embedjobs\/js\/[0-9a-f-]+/i.test(rawHtml)
    && normalized.includes('pioneer the future of construction')
    && normalized.includes('join a motivated and innovative team')
}

export const hasSitemapCareersSignal = (sitemapXml = '') =>
  /https:\/\/arisinfra\.com\/pages\/careers(?:\/|<|\?|#|$)/i.test(String(sitemapXml ?? ''))

export const extractCareerConfig = (html = '') => {
  const configBlock = String(html ?? '').match(/window\.khConfig\s*=\s*\{([\s\S]*?)\}\s*;?/i)?.[1]
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

const toLocationLabel = (location = {}) => {
  const city = normalizeWhitespace(location.city) || normalizeWhitespace(location.name)
  const state = normalizeWhitespace(location.state)

  return [city, state, 'India']
    .filter((part, index, values) => part && values.indexOf(part) === index)
    .join(', ')
}

const hasExpectedCareerPortalInfo = (info = {}) => {
  if (info == null || typeof info !== 'object' || Array.isArray(info)) return false

  return String(info.careersPortalDomain || '').toLowerCase() === EXPECTED_CAREERS_PORTAL_DOMAIN
    && sameUrl(info.companyWebsite, HOMEPAGE_URL)
    && normalizeWhitespace(info.name) === 'Aris'
    && normalizeWhitespace(info.shortName) === 'Aris'
    && normalizeWhitespace(info.jobListingSetting?.groupBy) === 'location'
}

const mapJob = (job, { domain } = {}) => {
  const indiaLocations = (Array.isArray(job?.jobLocations) ? job.jobLocations : [])
    .filter(isIndiaLocation)
  const jobId = normalizeWhitespace(job?.id)
  const title = normalizeWhitespace(job?.title)
  const detailUrl = buildJobDetailUrl({ domain, jobId })
  const applyUrl = buildApplyUrl({ domain, jobId })

  if (!jobId || !title || indiaLocations.length === 0 || !detailUrl || !applyUrl) {
    return null
  }

  const primaryLocation = indiaLocations[0]
  const city = normalizeWhitespace(primaryLocation.city) || normalizeWhitespace(primaryLocation.name)

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(job.departmentName),
    location: toLocationLabel(primaryLocation) || 'India',
    city,
    country: 'India',
    jobId,
    requisitionId: normalizeWhitespace(job.jobNumber) || jobId,
    sourceUrl: detailUrl,
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
  }
}

export const extractSearchResults = (payload, { domain } = {}) =>
  (Array.isArray(payload) ? payload : [])
    .map((job) => mapJob(job, { domain }))
    .filter(Boolean)

export const createArisInfraScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchPage = defaultFetchPage, fetchJson = defaultFetchJson } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      homepage.status !== 200
      || !sameUrl(homepage.url, HOMEPAGE_URL)
      || !hasOfficialHomepageSignal(homepage.html)
    ) {
      throw new Error('ArisInfra verified official homepage no longer matches the known first-party surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (
      careersPage.status !== 200
      || !sameUrl(careersPage.url, CAREERS_URL)
      || !hasVerifiedCareersPageSignal(careersPage.html)
    ) {
      throw new Error('ArisInfra verified first-party careers page no longer matches the known public shell')
    }

    const sitemapPage = await fetchPage(SITEMAP_URL)
    if (sitemapPage.status !== 200 || !hasSitemapCareersSignal(sitemapPage.html)) {
      throw new Error('ArisInfra verified sitemap no longer advertises the known careers surface')
    }

    const careerConfig = extractCareerConfig(careersPage.html)
    if (!careerConfig) {
      throw new Error('ArisInfra verified first-party careers page no longer exposes window.khConfig')
    }

    if (
      careerConfig.identifier !== EXPECTED_IDENTIFIER
      || careerConfig.domain !== EXPECTED_KEKA_DOMAIN
      || careerConfig.portalName !== 'default'
    ) {
      throw new Error('ArisInfra verified Keka job surface changed materially')
    }

    const portalInfo = await fetchJson(CAREER_PORTAL_INFO_URL)
    if (
      portalInfo.status !== 200
      || !sameUrl(portalInfo.url, CAREER_PORTAL_INFO_URL)
      || !hasExpectedCareerPortalInfo(portalInfo.json)
    ) {
      throw new Error('ArisInfra verified career portal info no longer matches the known public surface')
    }

    const activeJobsUrl = buildActiveJobsUrl(careerConfig)
    if (!activeJobsUrl) {
      throw new Error('Unable to build ArisInfra active jobs URL')
    }

    const activeJobs = await fetchJson(activeJobsUrl)
    if (
      activeJobs.status !== 200
      || !sameUrl(activeJobs.url, activeJobsUrl)
      || !Array.isArray(activeJobs.json)
    ) {
      throw new Error('ArisInfra verified active jobs feed no longer matches the known public surface')
    }

    return extractSearchResults(activeJobs.json, careerConfig).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createArisInfraScraper(options).run(options)

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
