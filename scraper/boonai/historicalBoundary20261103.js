import { createFailClosedSentinelScraper } from './failClosedSentinel.js'

export const SOURCE = 'boonai'
export const COMPANY = 'BoonAI'
export const OFFICIAL_BRAND = 'Boon.ai'
export const VERIFIED_ON = '2026-08-14'
export const HOME_URL = 'https://www.boonindia.ai/'
export const ABOUT_URL = 'https://www.boonindia.ai/about'
export const PRICING_URL = 'https://www.boonindia.ai/pricing'
export const EMPLOYER_REGISTER_URL = 'https://employer.boonindia.ai/register'
export const CAREERS_URL = ABOUT_URL
export const DISPOSITION =
  'verified-public-platform-and-recruiter-surfaces-without-exact-company-careers-contract'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, August 14, 2026 that https://www.boonindia.ai/ and https://www.boonindia.ai/about remained the live official public Boon.ai surfaces reviewed for workbook company BoonAI, that https://www.boonindia.ai/pricing and https://employer.boonindia.ai/register still exposed recruiter-facing marketplace and employer registration flows, and that the current employer registration page now begins with a registration-type chooser rather than agency-name and license-number fields. These reviewed surfaces still establish Boon.ai as an overseas jobs platform rather than a trustworthy exact-company BoonAI careers contract, so this company-local scraper stays fail-closed and returns no jobs until a stable official BoonAI openings surface is verified.'

const HOME_REQUIRED_PATTERNS = [
  /\byour international career starts here\b/i,
  /\bfind your international job now\b/i,
  /\bverified licensed agencies\b/i,
  /\bwalk-in interviews happening across india\b/i,
  /\bget the boon\.ai mobile app\b/i,
  /\bboon gives you the tools and trusted network\b/i,
]

const ABOUT_REQUIRED_PATTERNS = [
  /\bboon\.ai is a next-generation job board\b/i,
  /\bspecialized platform for gulf jobs\b/i,
  /\bai-powered job ad conversion\b/i,
  /\bdirect job applications\b/i,
  /support@boonindia\.ai/i,
  /\bboon infomate private limited\b/i,
]

const PRICING_REQUIRED_PATTERNS = [
  /\bboonpromo\b/i,
  /\bjob posting plans for licensed overseas recruitment agencies\b/i,
  /\b60 ad postings\b/i,
  /\bunlimited applications\b/i,
  /\bpost a job today\b/i,
]

const EMPLOYER_REGISTER_REQUIRED_PATTERNS = [
  /\bboon\.ai\b/i,
  /\bhow would you like to register\?/i,
  /\bagency\b/i,
  /\b(?:client\s*\/\s*)?foreign employer\b/i,
  /\bcontinue\b/i,
  /\balready have an account\s*\?\s*login\b/i,
]

const TRUSTED_ATS_HOST_PATTERNS = [
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /jobs\.ashbyhq\.com/i,
  /ashbyhq\.com/i,
  /myworkdayjobs\.com/i,
  /workdayjobs\.com/i,
  /smartrecruiters\.com/i,
  /jobvite\.com/i,
  /workable\.com/i,
  /bamboohr\.com/i,
  /applytojob\.com/i,
  /recruitee\.com/i,
  /zohorecruit\.in/i,
  /darwinbox/i,
  /kekahire\.com/i,
  /teamtailor\.com/i,
  /freshteam\.com/i,
  /icims\.com$/i,
]

const EXACT_COMPANY_HIRING_COPY_PATTERNS = [
  /\bcareers at boon(?:\.ai)?\b/i,
  /\bboon(?:\.ai)? careers\b/i,
  /\bjoin (?:the )?boon(?:\.ai)? team\b/i,
  /\bwe(?:'|)re hiring at boon(?:\.ai)?\b/i,
  /\bopen(?:ing|ings)? at boon(?:\.ai)?\b/i,
  /\bwork at boon(?:\.ai)?\b/i,
  /\blife at boon(?:\.ai)?\b/i,
]

const EXACT_COMPANY_JOB_PATH_PATTERNS = [
  /^\/careers?(?:\/|$)/i,
  /^\/join-us(?:\/|$)/i,
  /^\/work-with-us(?:\/|$)/i,
  /^\/hiring(?:\/|$)/i,
  /^\/our-team(?:\/|$)/i,
  /^\/life-at-boon(?:\/|$)/i,
  /^\/jobs\/(?:boon(?:-?ai)?|boonindia|company|team)(?:\/|$)/i,
]

const COMPANY_EMAIL_JOB_LOCALS = /^(careers|jobs|hiring|talent|workwithus)$/i

const decodeEntities = (value = '') =>
  String(value)
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
    .replace(/[\u2013\u2014]/g, '-')

const normalizeText = (value = '') =>
  decodeEntities(String(value))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizePathname = (value = '') => {
  const normalized = String(value).trim().replace(/\/+$/, '')
  return normalized || '/'
}

const extractLinkedUrls = (html = '', pageUrl) => {
  const urls = []
  const matches = String(html).matchAll(
    /(?:href|src|action|data-url|content)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
  )

  for (const match of matches) {
    const rawValue = match[1] || match[2] || match[3] || ''

    try {
      urls.push(new URL(decodeEntities(rawValue), pageUrl))
    } catch {
      // Ignore malformed URLs and keep the scraper fail-closed.
    }
  }

  return urls
}

const hasExactCompanyJobPostingMarkup = (html = '') => {
  const blocks = String(html).matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )

  for (const block of blocks) {
    if (
      /\bJobPosting\b/i.test(block[1])
      && /\bboon(?:\.ai)?\b|\bboon infomate private limited\b/i.test(block[1])
    ) {
      return true
    }
  }

  return false
}

const isLinkedInCompanyJobsUrl = (url) =>
  /(?:^|\.)linkedin\.com$/i.test(url.hostname)
  && /^\/company\/boon-ai\/jobs\/?$/i.test(url.pathname)

const isExactCompanyJobsUrl = (url) => {
  if (isLinkedInCompanyJobsUrl(url)) return true
  if (TRUSTED_ATS_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname))) return true

  const sameBrandHost = /(?:^|\.)boonindia\.ai$/i.test(url.hostname)
    || /(?:^|\.)employer\.boonindia\.ai$/i.test(url.hostname)

  if (!sameBrandHost) return false

  const pathname = normalizePathname(url.pathname)
  if (EXACT_COMPANY_JOB_PATH_PATTERNS.some((pattern) => pattern.test(pathname))) return true

  return /^\/jobs(?:\/|$)/i.test(pathname) && /\bboon(?:-?ai)?\b/i.test(url.search)
}

const validateRequiredPatterns = (html, patterns, message) => {
  const text = normalizeText(html)

  if (patterns.every((pattern) => pattern.test(text))) return

  throw new Error(message)
}

export const hasVerifiedHomeSurface = (html = '') => {
  const text = normalizeText(html)
  return HOME_REQUIRED_PATTERNS.every((pattern) => pattern.test(text))
}

export const hasVerifiedAboutSurface = (html = '') => {
  const text = normalizeText(html)
  return ABOUT_REQUIRED_PATTERNS.every((pattern) => pattern.test(text))
}

export const hasVerifiedPricingSurface = (html = '') => {
  const text = normalizeText(html)
  return PRICING_REQUIRED_PATTERNS.every((pattern) => pattern.test(text))
}

export const hasVerifiedEmployerRegisterSurface = (html = '') => {
  const text = normalizeText(html)
  return EMPLOYER_REGISTER_REQUIRED_PATTERNS.every((pattern) => pattern.test(text))
}

export const detectExactCompanyJobsSurface = (html = '', pageUrl) => {
  if (hasExactCompanyJobPostingMarkup(html)) return 'exact-company JobPosting markup'

  const text = normalizeText(html)
  if (EXACT_COMPANY_HIRING_COPY_PATTERNS.some((pattern) => pattern.test(text))) {
    return 'exact-company hiring copy'
  }

  const publicJobsUrl = extractLinkedUrls(html, pageUrl).find(isExactCompanyJobsUrl)
  return publicJobsUrl ? publicJobsUrl.toString() : null
}

const assertNoExactCompanyJobsSurface = (html, pageUrl) => {
  const detectedSurface = detectExactCompanyJobsSurface(html, pageUrl)
  if (!detectedSurface) return

  throw new Error(
    `BoonAI official public surface now exposes an exact-company public jobs surface via ${detectedSurface}.`,
  )
}

const defaultFetchHtml = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (compatible; Jobverify/1.0)',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

export const createBoonAIScraper = () => ({
  async run({ fetchHtml = defaultFetchHtml } = {}) {
    const homeHtml = await fetchHtml(HOME_URL)
    validateRequiredPatterns(
      homeHtml,
      HOME_REQUIRED_PATTERNS,
      'BoonAI verified public marketplace home surface changed; review the official public contract.',
    )
    assertNoExactCompanyJobsSurface(homeHtml, HOME_URL)

    const aboutHtml = await fetchHtml(ABOUT_URL)
    validateRequiredPatterns(
      aboutHtml,
      ABOUT_REQUIRED_PATTERNS,
      'BoonAI verified company about surface changed; review the official public contract.',
    )
    assertNoExactCompanyJobsSurface(aboutHtml, ABOUT_URL)

    const pricingHtml = await fetchHtml(PRICING_URL)
    validateRequiredPatterns(
      pricingHtml,
      PRICING_REQUIRED_PATTERNS,
      'BoonAI verified recruiter pricing surface changed; review the official public contract.',
    )
    assertNoExactCompanyJobsSurface(pricingHtml, PRICING_URL)

    const employerRegisterHtml = await fetchHtml(EMPLOYER_REGISTER_URL)
    validateRequiredPatterns(
      employerRegisterHtml,
      EMPLOYER_REGISTER_REQUIRED_PATTERNS,
      'BoonAI verified employer registration surface changed; review the official public contract.',
    )
    assertNoExactCompanyJobsSurface(employerRegisterHtml, EMPLOYER_REGISTER_URL)

    return createFailClosedSentinelScraper().run()
  },
})

export const run = async (options = {}) => createBoonAIScraper().run(options)
