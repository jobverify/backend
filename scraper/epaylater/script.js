import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { EPAYLATER_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = EPAYLATER_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const CAREER_PORTAL_INFO_URL = PROVIDER_METADATA.careerPortalInfoUrl
export const EXPECTED_KEKA_DOMAIN = PROVIDER_METADATA.expectedKekaDomain
export const EXPECTED_IDENTIFIER = PROVIDER_METADATA.expectedIdentifier
export const EXPECTED_CAREERS_PORTAL_DOMAIN = 'epaylater.keka.com'

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

  return extractTitle(rawHtml) === 'Grow your Business | Get Instant Credit upto 25Lacs at 0% Interest | Buynow Paylater - ePayLater'
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.epaylater\.in\/["']/i.test(rawHtml)
    && /href=["']careers\.html["'][^>]*class=["'][^"']*nav-link/i.test(rawHtml)
    && /https:\/\/www\.linkedin\.com\/company\/epaylater\//i.test(rawHtml)
    && /Supplier Login/i.test(rawHtml)
    && /Blog/i.test(rawHtml)
}

export const hasVerifiedCareersPageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return extractTitle(rawHtml) === 'Career'
    && /Explore Vacancies/i.test(rawHtml)
    && /Job Application Form/i.test(rawHtml)
    && /mailto:careers@epaylater\.in/i.test(rawHtml)
    && /id=["']job-opening["']/i.test(rawHtml)
    && /https:\/\/epaylater\.keka\.com\/careers\/api\/embedjobs\/[0-9a-f-]{36}/i.test(rawHtml)
    && /https:\/\/verify-internal\.epaylater\.in\/v1\/career\/applicant/i.test(rawHtml)
    && normalized.includes('Fill out the form below to apply for job opening')
}

const parseQuotedConfigValue = (block, key) => {
  const match = String(block ?? '').match(new RegExp(`${key}\\s*:\\s*['"]([^'"]+)['"]`, 'i'))
  return normalizeWhitespace(match?.[1] || null)
}

export const extractCareerConfig = (html = '') => {
  const configBlock = String(html ?? '').match(/window\.khConfig\s*=\s*\{([\s\S]*?)\}\s*;?/i)?.[1]
  if (configBlock) {
    const identifier = parseQuotedConfigValue(configBlock, 'identifier')
    const domain = normalizeDomain(parseQuotedConfigValue(configBlock, 'domain'))
    const portalName = parseQuotedConfigValue(configBlock, 'portalName') || 'default'

    if (identifier && domain) {
      return { identifier, domain, portalName }
    }
  }

  const iframeMatch = String(html ?? '').match(
    /https:\/\/([a-z0-9-]+\.keka\.com)\/careers\/api\/embedjobs\/([0-9a-f-]{36})/i,
  )

  if (!iframeMatch) return null

  return {
    identifier: iframeMatch[2],
    domain: `https://${iframeMatch[1]}/careers/`,
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

const hasExpectedCareerPortalInfo = (info = {}) => {
  if (info == null || typeof info !== 'object' || Array.isArray(info)) return false

  const filters = Array.isArray(info.jobListingSetting?.filters)
    ? info.jobListingSetting.filters.map((value) => normalizeWhitespace(value)).filter(Boolean)
    : []
  const fields = Array.isArray(info.jobListingSetting?.jobFields)
    ? info.jobListingSetting.jobFields.map((value) => normalizeWhitespace(value)).filter(Boolean)
    : []

  return String(info.careersPortalDomain || '').toLowerCase() === EXPECTED_CAREERS_PORTAL_DOMAIN
    && normalizeWhitespace(info.name) === 'ePayLater'
    && normalizeWhitespace(info.shortName) === 'ePayLater'
    && normalizeWhitespace(info.fontFamily) === 'Roboto'
    && filters.includes('department')
    && filters.includes('location')
    && filters.includes('jobType')
    && fields.includes('location')
    && fields.includes('experience')
    && fields.includes('salaryRange')
}

const extractLocationFromDescription = (descriptionHtml = '') => {
  const descriptionText = stripHtml(descriptionHtml)
  if (!descriptionText) return null

  const match = descriptionText.match(/\bLocation\s*:?\s*([\s\S]+)/i)
  if (!match) return null

  let candidate = normalizeWhitespace(match[1])
  if (!candidate) return null

  const followupMatch = candidate.match(
    /^(.*?)(?=\b(?:About ePayLater|Role Overview|Key Responsibilities|Job Purpose|Reports To|Direct Reports|Company:|Position Title:|Department:|Employment Type|Job Summary|Summary:|You will be expected|Qualifications|Experience)\b)/i,
  )

  if (followupMatch) {
    candidate = normalizeWhitespace(followupMatch[1])
  }

  return candidate || null
}

const extractCityFromLabel = (label) => {
  const normalized = normalizeWhitespace(label)
  if (!normalized) return null

  const city = normalizeWhitespace(normalized.split('(')[0]?.split(',')[0])
  return city || null
}

const toEmploymentType = (jobType) => (jobType === 2 || jobType === '2' ? 'Full Time' : null)

const normalizePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

const toStructuredLocation = (location = {}) => {
  const city = normalizeWhitespace(location.city) || normalizeWhitespace(location.name)
  if (!city) return null

  return {
    location: /india/i.test(city) ? city : `${city}, India`,
    city,
  }
}

const deriveLocation = (job = {}) => {
  const primaryLocation = Array.isArray(job.jobLocations)
    ? job.jobLocations.find((location) => normalizeWhitespace(location?.city) || normalizeWhitespace(location?.name))
    : null

  if (primaryLocation) {
    return toStructuredLocation(primaryLocation) || { location: 'India', city: null }
  }

  const descriptionLocation = extractLocationFromDescription(job.description)
  if (descriptionLocation) {
    return {
      location: /india/i.test(descriptionLocation) ? descriptionLocation : `${descriptionLocation}, India`,
      city: extractCityFromLabel(descriptionLocation),
    }
  }

  return {
    location: 'India',
    city: null,
  }
}

const mapJob = (job, { domain } = {}) => {
  const jobId = normalizeWhitespace(job?.id)
  const title = normalizeWhitespace(job?.title)
  const detailUrl = buildJobDetailUrl({ domain, jobId })
  const applyUrl = buildApplyUrl({ domain, jobId })

  if (!jobId || !title || !detailUrl || !applyUrl) {
    return null
  }

  const derivedLocation = deriveLocation(job)

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(job.departmentName),
    location: derivedLocation.location || 'India',
    city: derivedLocation.city,
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

export const createEPayLaterScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchPage = defaultFetchPage, fetchJson = defaultFetchJson } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      homepage.status !== 200
      || !sameUrl(homepage.url, HOMEPAGE_URL)
      || !hasOfficialHomepageSignal(homepage.html)
    ) {
      throw new Error('ePayLater verified official homepage no longer matches the known first-party surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (
      careersPage.status !== 200
      || !sameUrl(careersPage.url, CAREERS_URL)
      || !hasVerifiedCareersPageSignal(careersPage.html)
    ) {
      throw new Error('ePayLater verified first-party careers page no longer matches the known public shell')
    }

    const careerConfig = extractCareerConfig(careersPage.html)
    if (!careerConfig) {
      throw new Error('ePayLater verified first-party careers page no longer exposes the embedded Keka configuration')
    }

    if (
      careerConfig.identifier !== EXPECTED_IDENTIFIER
      || careerConfig.domain !== EXPECTED_KEKA_DOMAIN
      || careerConfig.portalName !== 'default'
    ) {
      throw new Error('ePayLater verified Keka job surface changed materially')
    }

    const portalInfo = await fetchJson(CAREER_PORTAL_INFO_URL)
    if (
      portalInfo.status !== 200
      || !sameUrl(portalInfo.url, CAREER_PORTAL_INFO_URL)
      || !hasExpectedCareerPortalInfo(portalInfo.json)
    ) {
      throw new Error('ePayLater verified career portal info no longer matches the known public surface')
    }

    const activeJobsUrl = buildActiveJobsUrl(careerConfig)
    if (!activeJobsUrl) {
      throw new Error('Unable to build ePayLater active jobs URL')
    }

    const activeJobs = await fetchJson(activeJobsUrl)
    if (
      activeJobs.status !== 200
      || !sameUrl(activeJobs.url, activeJobsUrl)
      || !Array.isArray(activeJobs.json)
    ) {
      throw new Error('ePayLater verified active jobs feed no longer matches the known public surface')
    }

    const scrapedAt = now()

    return extractSearchResults(activeJobs.json, careerConfig).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createEPayLaterScraper(options).run(options)

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
