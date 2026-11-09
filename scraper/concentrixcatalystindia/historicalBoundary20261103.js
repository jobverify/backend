import { createFailClosedSentinelScraper } from './failClosedSentinel.js'

export const SOURCE = 'concentrixcatalystindia'
export const COMPANY = 'Concentrix Catalyst India'
export const OFFICIAL_BRAND = 'Concentrix Catalyst'
export const VERIFIED_ON = '2026-09-03'
export const CAREERS_URL = 'https://in.linkedin.com/company/concentrix-catalyst'
export const PARENT_INDIA_URL = 'https://www.concentrix.com/india/'
export const LINKEDIN_INDIA_JOBS_URL = 'https://in.linkedin.com/jobs/concentrix-catalyst-jobs'
export const DISPOSITION =
  'verified-exact-name-linkedin-company-surface-plus-parent-careers-handoff-without-trustworthy-exact-company-jobs-contract'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on September 3, 2026 that https://in.linkedin.com/company/concentrix-catalyst remained the live exact-name public company surface reviewed for workbook company Concentrix Catalyst India, that it pointed to https://catalyst.concentrix.com/ and exposed India locations including Bangalore, Chennai, and Hyderabad, and that the broader official India surface at https://www.concentrix.com/india/ handed applicants to the general Concentrix careers site at jobs.concentrix.com. The reviewed public LinkedIn jobs search at https://in.linkedin.com/jobs/concentrix-catalyst-jobs now advertises 1,000+ India roles, but its visible result data is attributed to the parent Concentrix brand rather than the exact workbook company. Because the reviewed public surfaces did not establish a trustworthy exact-company Concentrix Catalyst India enumerable jobs contract, this company-local scraper stays fail-closed and returns no jobs until a stable exact-company public openings flow is verified.'

const LINKEDIN_COMPANY_REQUIRED_PATTERNS = [
  /\bConcentrix Catalyst\b/i,
  /\bIT Services and IT Consulting\b/i,
  /https:\/\/catalyst\.concentrix\.com\//i,
  /\bBangalore,\s*560078,\s*IN\b/i,
  /\bChennai,\s*IN\b/i,
  /\bHyderabad,\s*IN\b/i,
  /\bSee jobs\b/i,
]

const PARENT_INDIA_REQUIRED_PATTERNS = [
  /\bHere at Concentrix India\b/i,
  /\bJoin Our Team\b/i,
  /\bExperience the power of a game-changing career\./i,
  /\b15 locations across India\b/i,
  /\bHuman centered\.\s*Tech-powered\.\s*Intelligence-fueled\./i,
]

const LINKEDIN_INDIA_JOBS_REQUIRED_PATTERNS = [
  /\bConcentrix\b/i,
  /\b(?:Hyderabad|Bengaluru|Thane|Chennai|Gurugram)\b/i,
]

const PARENT_CAREERS_HANDOFF_PATTERN = /^https?:\/\/jobs\.concentrix\.com(?:\/|$)/i
const EXACT_COMPANY_LABEL_PATTERN = /^Concentrix Catalyst(?: India)?$/i

const decodeEntities = (value = '') =>
  String(value)
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;|&rsquo;|&#8217;/gi, "'")

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeEntities(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value = '') =>
  normalizeWhitespace(
    decodeEntities(String(value))
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  ) || ''

const extractLinkedUrls = (html = '', pageUrl) => {
  const urls = []
  const matches = String(html).matchAll(
    /(?:href|src|action|data-url)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
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

export const extractVisibleCompanyLabels = (html = '') => {
  const labels = new Set()

  for (const match of String(html).matchAll(
    /<h4[^>]*>\s*(?:<a[^>]*>)?\s*([\s\S]*?)\s*(?:<\/a>)?\s*<\/h4>/gi,
  )) {
    const label = stripTags(match[1])
    if (label) labels.add(label)
  }

  return [...labels]
}

export const extractParentCareersHandoff = (html = '', pageUrl = PARENT_INDIA_URL) =>
  extractLinkedUrls(html, pageUrl)
    .map((url) => url.toString())
    .find((url) => PARENT_CAREERS_HANDOFF_PATTERN.test(url)) || null

export const assertVerifiedLinkedInCompanySurface = (html = '') => {
  const text = stripTags(html)

  if (LINKEDIN_COMPANY_REQUIRED_PATTERNS.every((pattern) => pattern.test(text))) return

  throw new Error(
    'Concentrix Catalyst India verified exact-name LinkedIn company surface changed; review the public contract before promoting a real parser.',
  )
}

export const assertVerifiedParentIndiaSurface = (html = '') => {
  const text = stripTags(html)

  if (PARENT_INDIA_REQUIRED_PATTERNS.every((pattern) => pattern.test(text))) return

  throw new Error(
    'Concentrix Catalyst India verified parent Concentrix India surface changed; review the public contract before promoting a real parser.',
  )
}

export const assertVerifiedParentCareersHandoff = (html = '', pageUrl = PARENT_INDIA_URL) => {
  if (extractParentCareersHandoff(html, pageUrl)) return

  throw new Error(
    'Concentrix Catalyst India verified parent careers handoff changed; review the public contract.',
  )
}

export const assertVerifiedLinkedInIndiaJobsShell = (html = '') => {
  const text = stripTags(html)
  const missingPatterns = LINKEDIN_INDIA_JOBS_REQUIRED_PATTERNS
    .filter((pattern) => !pattern.test(text))

  if (missingPatterns.length > 0) {
    throw new Error(
      `Concentrix Catalyst India verified public LinkedIn jobs search shell changed; missing ${missingPatterns.map((pattern) => pattern.source).join(', ')}.`,
    )
  }

  const companyLabels = extractVisibleCompanyLabels(html)
  const exactCompanyLabel = companyLabels.find((label) => EXACT_COMPANY_LABEL_PATTERN.test(label))
  if (exactCompanyLabel) {
    throw new Error(
      'Concentrix Catalyst India public jobs search now exposes an exact-company listing contract; promote a real parser.',
    )
  }

  if (!companyLabels.includes('Concentrix')) {
    throw new Error(
      'Concentrix Catalyst India verified public LinkedIn jobs search no longer shows the reviewed parent-brand listing contract.',
    )
  }
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

export const createConcentrixCatalystIndiaScraper = () => ({
  async run({ fetchHtml = defaultFetchHtml } = {}) {
    const linkedinCompanyHtml = await fetchHtml(CAREERS_URL)
    assertVerifiedLinkedInCompanySurface(linkedinCompanyHtml)

    const parentIndiaHtml = await fetchHtml(PARENT_INDIA_URL)
    assertVerifiedParentIndiaSurface(parentIndiaHtml)
    assertVerifiedParentCareersHandoff(parentIndiaHtml, PARENT_INDIA_URL)

    const linkedinJobsHtml = await fetchHtml(LINKEDIN_INDIA_JOBS_URL)
    assertVerifiedLinkedInIndiaJobsShell(linkedinJobsHtml)

    return createFailClosedSentinelScraper().run()
  },
})

export const run = async (options = {}) => createConcentrixCatalystIndiaScraper().run(options)
