import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const SOURCE = 'covalensedigital'
export const COMPANY = 'Covalense Digital'
export const OFFICIAL_BRAND = 'Covalense Digital'
export const VERIFIED_ON = '2026-07-25'
export const CAREERS_URL = 'https://covalensedigital.com/careers'
export const CAREERS_CONTACT_URL = `${CAREERS_URL}#careers-contact`
export const CAREERS_API_BASE_URL = 'https://testingbe.covalensedigital.com'
export const CAREERS_API_URL = `${CAREERS_API_BASE_URL}/api/auth/getlistof-career`
export const DISPOSITION = 'verified-first-party-careers-page-plus-public-careers-api'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 25, 2026 that https://covalensedigital.com/careers was the live first-party Covalense Digital careers surface, that its public client-side bundle resolved the careers API contract to https://testingbe.covalensedigital.com/api/auth/getlistof-career, and that the public API exposed current openings including India roles such as GenAI & LLM Engineer, Machine Learning Engineer, Oracle BRM Developer, and Java Developer. The same public inventory also included a US-only Software Architect role in Herndon, Virginia, so this scraper validates the verified page-plus-bundle contract and returns India jobs only from the public careers API.'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const REQUIRED_CAREERS_PAGE_PATTERNS = [
  /<title[^>]*>\s*Join Covalense Digital\s*\|\s*Telecom and Tech Jobs\s*\|\s*Careers\s*<\/title>/i,
  /\bJoin Our Journey\b/i,
  /\bLife at Covalense Digital\b/i,
  /\bContinuous Learning and Development\b/i,
  /\bCurrent Openings\b/i,
  /\bContact Us Form\b/i,
  /careers@covalensedigital\.com/i,
  /\bid=['"]careers-contact['"]/i,
]

const INDIA_LOCATION_PATTERN =
  /\b(?:india|bengaluru|bangalore|hyderabad|chennai|mumbai|pune|gurugram|gurgaon|noida|delhi|kolkata|ahmedabad|kochi|coimbatore)\b/i

const decodeEntities = (value = '') =>
  String(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, '-')
    .replace(/&mdash;|&#8212;/gi, '-')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeEntities(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value = '') =>
  normalizeWhitespace(
    decodeEntities(String(value))
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '\n')
      .replace(/<p\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  try {
    return new URL(String(value ?? ''), baseUrl).toString()
  } catch {
    return null
  }
}

const normalizePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const buildJobNumber = (job = {}, index = 0) => {
  const rawValue = Number.isFinite(Number(job?.order))
    ? Number(job.order)
    : index + 1

  return String(Math.max(1, rawValue)).padStart(2, '0')
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalized.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)[0] || null
}

const isIndiaLocation = (location) => INDIA_LOCATION_PATTERN.test(normalizeWhitespace(location) || '')

const isTrustworthyApiJob = (job = {}) =>
  Boolean(
    normalizeWhitespace(job?._id)
      && normalizeWhitespace(job?.job_name)
      && normalizeWhitespace(job?.job_description)
      && normalizeWhitespace(job?.location),
  )

export const hasOfficialCareersPageSignal = (html = '') =>
  REQUIRED_CAREERS_PAGE_PATTERNS.every((pattern) => pattern.test(String(html ?? '')))

export const extractScriptUrls = (html = '', pageUrl = CAREERS_URL) =>
  [...String(html ?? '').matchAll(/<script[^>]+src=["']([^"']+\.js[^"']*)["'][^>]*>/gi)]
    .map((match) => toAbsoluteUrl(match[1], pageUrl))
    .filter(Boolean)

export const extractVerifiedCareerApiBaseUrl = (scriptContents = []) => {
  const joined = scriptContents.map((value) => String(value ?? '')).join('\n')

  if (!/\/api\/auth\/getlistof-career\b/i.test(joined)) return null

  const baseUrl = joined.match(/https:\/\/testingbe\.covalensedigital\.com\b/i)?.[0] || null
  return baseUrl
}

const assertVerifiedCareerApiPayload = (payload = {}) => {
  const jobs = payload?.latestCompanyDetail
  if (!Array.isArray(jobs)) {
    throw new Error(
      'Covalense Digital public careers API payload changed materially; review the verified contract.',
    )
  }

  if (jobs.length > 0 && jobs.filter(isTrustworthyApiJob).length === 0) {
    throw new Error(
      'Covalense Digital public careers API payload changed materially; review the verified contract.',
    )
  }
}

const mapJob = (job = {}, index = 0) => {
  if (!isTrustworthyApiJob(job)) return null
  if (!isIndiaLocation(job.location)) return null

  return {
    title: normalizeWhitespace(job.job_name),
    company: COMPANY,
    department: null,
    location: normalizeWhitespace(job.location),
    city: extractCity(job.location),
    country: 'India',
    jobId: buildJobNumber(job, index),
    requisitionId: normalizeWhitespace(job._id),
    sourceUrl: CAREERS_URL,
    applyUrl: CAREERS_CONTACT_URL,
    employmentType: null,
    experienceRequired: normalizeWhitespace(job.experience),
    minimumQualification: normalizeWhitespace(job.education),
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizePostingDate(job.createdAt),
    closingDate: null,
    jobDescription: stripTags(job.job_description),
    remoteStatus: null,
  }
}

export const extractSearchResults = (payload = {}) =>
  (Array.isArray(payload?.latestCompanyDetail) ? payload.latestCompanyDetail : [])
    .map((job, index) => mapJob(job, index))
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
    Origin: 'https://covalensedigital.com',
    Referer: CAREERS_URL,
  },
  label: `${SOURCE}-json`,
  timeoutMs: 15000,
})

export const createCovalenseDigitalScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Covalense Digital verified official careers surface changed materially')
    }

    const scriptUrls = extractScriptUrls(careersHtml)
    if (scriptUrls.length === 0) {
      throw new Error('Covalense Digital verified client-side careers API contract changed materially')
    }

    const scriptContents = []
    for (const scriptUrl of scriptUrls) {
      scriptContents.push(await fetchText(scriptUrl))
    }

    if (extractVerifiedCareerApiBaseUrl(scriptContents) !== CAREERS_API_BASE_URL) {
      throw new Error('Covalense Digital verified client-side careers API contract changed materially')
    }

    const payload = await fetchJson(CAREERS_API_URL)
    assertVerifiedCareerApiPayload(payload)

    return extractSearchResults(payload).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createCovalenseDigitalScraper().run(options)
