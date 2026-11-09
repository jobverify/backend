import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const SOURCE = 'urbanpiper'
export const COMPANY = 'UrbanPiper'
export const HOMEPAGE_URL = 'https://www.urbanpiper.com/'
export const ABOUT_URL = 'https://www.urbanpiper.com/about-us'
export const KEKA_BOARD_URL = 'https://urbanpiper.keka.com/careers'
export const EXPECTED_IDENTIFIER = '896a0ed2-971f-4888-bc9b-d412677c6b9a'
export const EXPECTED_PORTAL_SLUG = 'default'
export const EXPECTED_PORTAL_DOMAIN = 'urbanpiper.keka.com'
export const EXPECTED_PORTAL_NAME = 'UrbanPiper'
export const EXPECTED_COMPANY_WEBSITE = 'https://www.urbanpiper.com/'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify/1.0)'

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
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString().replace(/\/+$/, '')
  } catch {
    return null
  }
}

const parseQuotedConfigValue = (block, key) => {
  const match = String(block ?? '').match(new RegExp(`${key}\\s*:\\s*['"]([^'"]+)['"]`, 'i'))
  return normalizeWhitespace(match?.[1] ?? null)
}

const toAbsoluteUrl = (value, baseUrl) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const extractAnchors = (html = '', baseUrl = HOMEPAGE_URL) => Array.from(
  String(html ?? '').matchAll(
    /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi,
  ),
  (match) => ({
    href: match[1] || match[2] || match[3] || null,
    label: normalizeWhitespace(match[4]) || null,
    url: toAbsoluteUrl(match[1] || match[2] || match[3] || null, baseUrl),
  }),
)

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title[^>]*>\s*UrbanPiper:\s*POS Integrations To Manage Online Orders\s*<\/title>/i.test(page)
    && normalized.includes('Orderline AI')
    && normalized.includes('Manage all your food ordering channels from your existing POS')
    && normalized.includes('Meraki')
}

export const hasOfficialAboutSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title[^>]*>\s*UrbanPiper\s*\|\s*About Us\s*<\/title>/i.test(page)
    && normalized.includes("UrbanPiper - Your Restaurant's Unfair Advantage")
    && normalized.includes('UrbanPiper provides restaurateurs with essential tools to build successful restaurants')
    && normalized.includes('What began as a vision to simplify restaurant management has grown into a platform')
    && normalized.includes('UrbanPiper started out as a modest 2 member team from a co-working space in Bengaluru.')
}

export const extractExternalHandoffUrl = (html = '', baseUrl = HOMEPAGE_URL) => {
  const expectedUrl = normalizeComparableUrl(KEKA_BOARD_URL)

  for (const anchor of extractAnchors(html, baseUrl)) {
    if (normalizeComparableUrl(anchor.url) === expectedUrl) {
      return KEKA_BOARD_URL
    }
  }

  return null
}

export const extractEmbeddedCareersDocumentPath = (html = '') =>
  String(html ?? '').match(/\/ats\/documents\/[0-9a-f-]+\/careerportal\/[^"' )]+\.html/i)?.[0] ?? null

export const extractCareerConfig = (html = '') => {
  const configBlock = String(html ?? '').match(/window\.khConfig\s*=\s*\{([\s\S]*?)\}\s*;?/i)?.[1] ?? ''
  const domain = normalizeDomain(parseQuotedConfigValue(configBlock, 'domain'))
  const portalName = parseQuotedConfigValue(configBlock, 'portalName') || EXPECTED_PORTAL_SLUG
  const identifier = normalizeWhitespace(parseQuotedConfigValue(configBlock, 'identifier'))
    || normalizeWhitespace(String(html ?? '').match(/api\/embedjobs\/js\/([0-9a-f-]+)/i)?.[1] ?? null)

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

export const createUrbanPiperScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml) || extractExternalHandoffUrl(homepageHtml, HOMEPAGE_URL) !== KEKA_BOARD_URL) {
      throw new Error('UrbanPiper verified homepage no longer matches the trusted first-party surface')
    }

    const aboutHtml = await fetchText(ABOUT_URL)
    if (!hasOfficialAboutSignal(aboutHtml) || extractExternalHandoffUrl(aboutHtml, ABOUT_URL) !== KEKA_BOARD_URL) {
      throw new Error('UrbanPiper verified about page no longer matches the trusted first-party surface')
    }

    const kekaShellHtml = await fetchText(KEKA_BOARD_URL)
    const embeddedDocumentPath = extractEmbeddedCareersDocumentPath(kekaShellHtml)
    if (!embeddedDocumentPath || !embeddedDocumentPath.includes(EXPECTED_IDENTIFIER)) {
      throw new Error('UrbanPiper verified Keka surface changed materially')
    }

    const embeddedCareersUrl = new URL(embeddedDocumentPath, KEKA_BOARD_URL).toString()
    const careerConfig = extractCareerConfig(await fetchText(embeddedCareersUrl))
    if (
      !careerConfig
      || careerConfig.identifier !== EXPECTED_IDENTIFIER
      || careerConfig.portalName !== EXPECTED_PORTAL_SLUG
      || normalizeDomain(careerConfig.domain) !== normalizeDomain(KEKA_BOARD_URL)
    ) {
      throw new Error('UrbanPiper verified Keka surface changed materially')
    }

    const careerPortalInfoUrl = buildCareerPortalInfoUrl(careerConfig)
    const activeJobsUrl = buildActiveJobsUrl(careerConfig)
    if (!careerPortalInfoUrl || !activeJobsUrl) {
      throw new Error('Unable to build UrbanPiper Keka endpoints')
    }

    const portalInfo = await fetchJson(careerPortalInfoUrl)
    if (!hasExpectedPortalIdentity(portalInfo)) {
      throw new Error('UrbanPiper verified Keka surface no longer matches the exact company identity')
    }

    const jobs = extractSearchResults(await fetchJson(activeJobsUrl), careerConfig)
    const selectedJobs = Number.isInteger(maxJobs) ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createUrbanPiperScraper().run(options)
