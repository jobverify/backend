import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'netmeds'
export const COMPANY = 'Netmeds'
export const CAREERS_URL = 'https://www.netmeds.com/'
export const CAREERS_PORTAL_URL = 'https://rcareers.ril.com/sap%28bD1lbiZjPTQ0OQ==%29/bc/bsp/sap/zerec_home_page/home_page.do'
export const RCARRERS_ORIGIN = 'https://rcareers.ril.com'
export const RCARRERS_SERVICE_ROOT = 'https://rcareers.ril.com/sap/opu/odata/sap/ZEREC_FIORI_CAND_REGISTRATION_SRV_0/'
export const DISPOSITION = 'verified-homepage-handoff-plus-public-rcareers-search'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Monday, August 3, 2026 that https://www.netmeds.com/ remained the live Netmeds exact-name public company surface, that its footer Career link handed applicants to the public Reliance Retail careers portal at https://rcareers.ril.com/sap%28bD1lbiZjPTQ0OQ==%29/bc/bsp/sap/zerec_home_page/home_page.do, and that the live Netmeds business search there returned zero current public openings. This scraper now validates the homepage-to-RCareers handoff and returns the portal\'s current Netmeds jobs when they exist.'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const REQUIRED_BRAND_PATTERN = /\bnetmeds(?:\.com)?\b/i
const TITLE_BRAND_PATTERN = /<title[^>]*>[\s\S]*?\bnetmeds(?:\.com)?\b[\s\S]*?<\/title>/i
const SURFACE_META_PATTERN =
  /(?:<link\b[^>]+rel=["'][^"']*canonical[^"']*["'][^>]+href=["']https:\/\/www\.netmeds\.com\/?["'][^>]*>)|(?:<meta\b[^>]+property=["']og:url["'][^>]+content=["']https:\/\/www\.netmeds\.com\/?["'][^>]*>)/i
const CAREERS_HOME_PATH_PATTERN = /\/bc\/bsp\/sap\/zerec_home_page\/home_page\.do$/i
const LISTING_COPY_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bopen roles\b/i,
  /\bavailable positions\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
]
const TRUSTED_ATS_HOST_PATTERNS = [
  /boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /jobs\.ashbyhq\.com/i,
  /ashbyhq\.com/i,
  /myworkdayjobs\.com/i,
  /smartrecruiters\.com/i,
  /jobvite\.com/i,
  /workable\.com/i,
  /bamboohr\.com/i,
  /applytojob\.com/i,
  /recruitee\.com/i,
  /darwinbox/i,
  /zohorecruit\.in/i,
]
const SAME_ORIGIN_JOB_PATH_PATTERNS = [
  /^\/careers?(?:\/|$)/i,
  /^\/jobs?(?:\/|$)/i,
  /^\/positions?(?:\/|$)/i,
  /^\/roles?(?:\/|$)/i,
  /^\/openings?(?:\/|$)/i,
  /^\/join-us(?:\/|$)/i,
  /^\/work-with-us(?:\/|$)/i,
  /^\/hiring(?:\/|$)/i,
  /^\/apply(?:\/|$)/i,
]

const normalizeText = (value = '') =>
  String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()

const normalizePathname = (value = '') => {
  const normalized = String(value).trim().replace(/\/+$/, '')
  return normalized || '/'
}

const parseJsonSafely = (value) => {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const extractLinkedUrls = (html = '', pageUrl = CAREERS_URL) => {
  const urls = []
  const matches = String(html).matchAll(
    /(?:href|src|action|data-url|data-href|content)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
  )

  for (const match of matches) {
    const rawValue = match[1] || match[2] || match[3] || ''

    try {
      urls.push(new URL(rawValue, pageUrl))
    } catch {
      // Ignore malformed URLs and keep the scraper fail-closed.
    }
  }

  return urls
}

const hasJobPostingMarkup = (html = '') => {
  const blocks = String(html).matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )

  for (const block of blocks) {
    if (/\bJobPosting\b/i.test(block[1])) return true
  }

  return false
}

const isKnownCareersPortalUrl = (value) => {
  try {
    const url = value instanceof URL ? value : new URL(value)
    return url.origin === RCARRERS_ORIGIN && CAREERS_HOME_PATH_PATTERN.test(url.pathname)
  } catch {
    return false
  }
}

const buildDropdownUrl = () =>
  `${RCARRERS_SERVICE_ROOT}DDDL_JOBSEARCHSet?$filter=${encodeURIComponent("Imode eq 'DDL' and Ijobtyp eq 'null'")}&$format=json&sap-language=EN&sap-client=449`

export const hasVerifiedCompanySurface = (html = '') => {
  const rawHtml = String(html)
  const text = normalizeText(rawHtml)

  return REQUIRED_BRAND_PATTERN.test(text)
    && TITLE_BRAND_PATTERN.test(rawHtml)
    && SURFACE_META_PATTERN.test(rawHtml)
}

export const hasVerifiedRelianceRetailCareersPortal = (html = '') => {
  const text = normalizeText(html).toLowerCase()

  return text.includes('welcome to reliance retail')
    && text.includes('job opportunities')
    && text.includes('register now to apply for our career opportunities')
    && text.includes('netmeds')
}

const findKnownCareersHandoffUrl = (html = '', pageUrl = CAREERS_URL) =>
  extractLinkedUrls(html, pageUrl).find((url) => isKnownCareersPortalUrl(url)) || null

const detectUnexpectedPublicJobsSurface = (html = '', careersUrl = CAREERS_URL) => {
  if (hasJobPostingMarkup(html)) return 'JobPosting markup'

  const text = normalizeText(html)
  if (LISTING_COPY_PATTERNS.some((pattern) => pattern.test(text))) {
    return 'listing copy'
  }

  const careersPage = new URL(careersUrl)
  const careersPath = normalizePathname(careersPage.pathname)
  const linkedUrls = extractLinkedUrls(html, careersUrl)

  const atsUrl = linkedUrls.find((url) =>
    TRUSTED_ATS_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname)),
  )
  if (atsUrl) return atsUrl.toString()

  const sameOriginJobUrl = linkedUrls.find((url) => {
    if (url.origin !== careersPage.origin) return false

    const pathname = normalizePathname(url.pathname)
    if (pathname === careersPath) return false

    return SAME_ORIGIN_JOB_PATH_PATTERNS.some((pattern) => pattern.test(pathname))
  })

  return sameOriginJobUrl ? sameOriginJobUrl.toString() : null
}

const assertVerifiedCompanySurface = (html = '') => {
  if (hasVerifiedCompanySurface(html)) return

  throw new Error(
    'Netmeds verified public company surface no longer matches the exact-name contract.',
  )
}

const assertVerifiedRelianceRetailCareersPortal = (html = '') => {
  if (hasVerifiedRelianceRetailCareersPortal(html)) return

  throw new Error(
    'Netmeds verified Reliance Retail careers handoff no longer matches the public portal contract.',
  )
}

const getNetmedsBusinessOption = (payload = {}) => {
  const results = Array.isArray(payload?.d?.results) ? payload.d.results : []
  return results.find((item) =>
    normalizeText(item?.Text).toLowerCase() === 'netmeds'
      && normalizeText(item?.Mode).toUpperCase() === 'BU'
      && normalizeText(item?.Value),
  ) || null
}

const readSetCookieValues = (headers) => {
  if (!headers) return []
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie()
  }

  const singleHeader = headers.get?.('set-cookie')
  return singleHeader ? [singleHeader] : []
}

const toCookieHeader = (headers) =>
  readSetCookieValues(headers)
    .map((value) => String(value).split(';')[0].trim())
    .filter(Boolean)
    .join('; ')

export const buildSearchPayload = ({ businessOption, jobType = null } = {}) => ({
  Mode: 'JOBLIST',
  JobTyp: jobType,
  ApplyJobURLNew: '',
  ApplyJobURLExisting: '',
  ViewJobURL: '',
  ReferralCode: '',
  MessageText: '',
  NavHeaderToJobSearch: [],
  NavJobSearchCriteriaSet: [
    {
      Imode: 'BU',
      Mode: 'BU',
      Value: normalizeText(businessOption?.Value),
      Text: normalizeText(businessOption?.Text),
    },
  ],
})

const buildPortalActionUrl = (basePath, postingId, tid) => {
  if (!basePath) return null

  try {
    const url = new URL(basePath, RCARRERS_ORIGIN)
    if (tid) url.searchParams.set('tid', tid)
    if (postingId) url.searchParams.set('pid', postingId)
    return url.toString()
  } catch {
    return null
  }
}

const parseSapDate = (value) => {
  const match = String(value || '').match(/\/Date\((\d+)(?:[+-]\d+)?\)\//)
  if (!match) return null

  const parsed = new Date(Number.parseInt(match[1], 10))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export const mapSearchResponseToJobs = (payload = {}) => {
  const data = payload?.d || payload || {}
  const viewJobUrl = normalizeText(data.ViewJobURL)
  const applyJobUrl = normalizeText(data.ApplyJobURLNew || data.ApplyJobURLExisting)
  const rows = Array.isArray(data.NavHeaderToJobSearch?.results)
    ? data.NavHeaderToJobSearch.results
    : Array.isArray(data.NavHeaderToJobSearch)
      ? data.NavHeaderToJobSearch
      : []

  return rows
    .map((row) => {
      const title = normalizeText(row.Jobtitle)
      const location = normalizeText(row.Location) || 'India'
      const department = normalizeText(row.FunArea)
      const business = normalizeText(row.Buisness) || COMPANY
      const postingId = normalizeText(row.EncryptedId)
      const jobCode = normalizeText(row.JobCode)
      const sourceUrl = buildPortalActionUrl(viewJobUrl, postingId, 'DJ') || CAREERS_PORTAL_URL
      const applyUrl = buildPortalActionUrl(applyJobUrl, postingId, 'AJ') || sourceUrl

      if (!title) return null

      return {
        title,
        company: COMPANY,
        location,
        source: SOURCE,
        sourceUrl,
        applyUrl,
        companyCareerPage: CAREERS_URL,
        companyDomain: 'netmeds.com',
        atsPlatform: 'reliance-retail-rcareers-odata',
        department,
        requisitionId: jobCode,
        jobId: postingId || jobCode,
        postedAt: parseSapDate(row.PostedOn),
        jobDescription: `Public Netmeds opening from the Reliance Retail careers portal. Business: ${business}.${department ? ` Functional Area: ${department}.` : ''}`,
        requiredSkills: [],
        experienceRequired: null,
      }
    })
    .filter(Boolean)
}

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return undefined

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const defaultFetchHtml = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': USER_AGENT,
    },
    signal: createTimeoutSignal(20000),
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

const defaultFetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
      ...(options.headers || {}),
    },
    body: options.body,
    signal: createTimeoutSignal(options.timeoutMs || 20000),
  })

  const bodyText = await response.text()
  const parsed = parseJsonSafely(bodyText)

  if (!response.ok) {
    const message = parsed?.error?.message?.value || bodyText.slice(0, 300) || `HTTP ${response.status}`
    throw new Error(`HTTP ${response.status} for ${url}: ${message}`)
  }

  if (parsed == null) {
    throw new Error(`Invalid JSON response for ${url}`)
  }

  return parsed
}

const defaultExecuteSearch = async ({ businessOption }) => {
  const sessionResponse = await fetch(RCARRERS_SERVICE_ROOT, {
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
      'X-CSRF-Token': 'Fetch',
      'X-Requested-With': 'X',
      DataServiceVersion: '2.0',
      MaxDataServiceVersion: '2.0',
    },
    signal: createTimeoutSignal(20000),
  })

  const sessionBody = await sessionResponse.text()
  if (!sessionResponse.ok) {
    throw new Error(`HTTP ${sessionResponse.status} for ${RCARRERS_SERVICE_ROOT}: ${sessionBody.slice(0, 300)}`)
  }

  const cookieHeader = toCookieHeader(sessionResponse.headers)
  const csrfToken = sessionResponse.headers.get('x-csrf-token')
  const payload = JSON.stringify(buildSearchPayload({ businessOption }))
  const searchResponse = await fetch(`${RCARRERS_SERVICE_ROOT}CandHeaderMyApplicationSet`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
      'X-Requested-With': 'X',
      DataServiceVersion: '2.0',
      MaxDataServiceVersion: '2.0',
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...(csrfToken && csrfToken.toLowerCase() !== 'required' ? { 'X-CSRF-Token': csrfToken } : {}),
    },
    body: payload,
    signal: createTimeoutSignal(20000),
  })

  const responseBody = await searchResponse.text()
  const parsed = parseJsonSafely(responseBody)

  if (!searchResponse.ok) {
    const message = parsed?.error?.message?.value || responseBody.slice(0, 300) || `HTTP ${searchResponse.status}`
    throw new Error(`HTTP ${searchResponse.status} for Netmeds RCareers search: ${message}`)
  }

  if (parsed == null) {
    throw new Error('Invalid JSON response from Netmeds RCareers search')
  }

  return parsed
}

export const createNetmedsScraper = ({
  careersUrl = CAREERS_URL,
  careersPortalUrl = CAREERS_PORTAL_URL,
} = {}) => ({
  async run({
    fetchHtml = defaultFetchHtml,
    fetchJson = defaultFetchJson,
    executeSearch = defaultExecuteSearch,
  } = {}) {
    const homepageHtml = await fetchHtml(careersUrl)
    assertVerifiedCompanySurface(homepageHtml)

    const unexpectedPublicJobsSurface = detectUnexpectedPublicJobsSurface(homepageHtml, careersUrl)
    if (unexpectedPublicJobsSurface) {
      throw new Error(
        `Netmeds public jobs surface changed materially: ${unexpectedPublicJobsSurface}`,
      )
    }

    const careersHandoffUrl = findKnownCareersHandoffUrl(homepageHtml, careersUrl)
    if (!careersHandoffUrl) {
      throw new Error(
        'Netmeds homepage no longer exposes the verified Reliance Retail careers handoff.',
      )
    }

    const portalHtml = await fetchHtml(careersPortalUrl)
    assertVerifiedRelianceRetailCareersPortal(portalHtml)

    const businessDropdown = await fetchJson(buildDropdownUrl())
    const businessOption = getNetmedsBusinessOption(businessDropdown)
    if (!businessOption) {
      throw new Error(
        'Netmeds business option no longer appears in the public Reliance Retail careers dropdown data.',
      )
    }

    const searchResponse = await executeSearch({ businessOption })
    return mapSearchResponseToJobs(searchResponse)
  },
})

export const run = async (options = {}) => createNetmedsScraper().run(options)

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
