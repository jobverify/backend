import { createFailClosedSentinelScraper } from './failClosedSentinel.js'

export const SOURCE = 'zwayam'
export const COMPANY = 'Zwayam'
export const OFFICIAL_BRAND = 'Zwayam'
export const CAREERS_URL = 'https://www.zwayam.com/career'
export const DISPOSITION = 'verified-public-careers-surface-with-info-edge-parent-handoff'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 25, 2026 that https://www.zwayam.com/career was the live first-party public careers surface reviewed for Zwayam. The verified surface presented the headline "Build the Future of Hiring with Zwayam" and the handoff copy "You will be redirected to Info Edge\'s Careers page (Zwayam\'s parent company)." Because the reviewed first-party surface only handed applicants to the parent company careers page and did not verify a trustworthy Zwayam-specific enumerable public jobs contract, this company-local scraper stays fail-closed and returns no jobs until an exact-company public openings flow is verified.'

const REQUIRED_SURFACE_PATTERNS = [
  /\bBuild the Future of Hiring with Zwayam\b/i,
  /At Zwayam, we're revolutionizing recruitment with AI, data, and automation\. If you're passionate about innovation and solving real-world challenges, we want you on our team\./i,
  /\bExplore Jobs\b/i,
  /\bopendoors@zwayam\.com\b/i,
]

const INFO_EDGE_PARENT_HANDOFF_PATTERN =
  /You will be redirected to Info Edge's Careers page \(Zwayam's parent company\)\./i

const TRUSTED_JOBS_HOST_PATTERNS = [
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
  /zohorecruit\.in/i,
  /darwinbox/i,
  /kekahire\.com/i,
  /public\.zwayam\.com/i,
]

const SAME_ORIGIN_JOB_PATH_PATTERNS = [
  /^\/career(?:\/|$)/i,
  /^\/careers?(?:\/|$)/i,
  /^\/jobs?(?:\/|$)/i,
  /^\/positions?(?:\/|$)/i,
  /^\/roles?(?:\/|$)/i,
  /^\/openings?(?:\/|$)/i,
  /^\/apply(?:\/|$)/i,
  /^\/join-us(?:\/|$)/i,
]

const decodeEntities = (value = '') =>
  String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
    .replace(/[\u2018\u2019]/g, "'")

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

const extractLinkedUrls = (html = '', pageUrl = CAREERS_URL) => {
  const matches = String(html).matchAll(
    /(?:href|src|action|data-url)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
  )
  const urls = []

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

const hasJobPostingMarkup = (html = '') => {
  const blocks = String(html).matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )

  for (const block of blocks) {
    if (/\bJobPosting\b/i.test(block[1])) return true
  }

  return false
}

export const assertVerifiedPublicCareersSurface = (html = '') => {
  const text = normalizeText(html)

  if (REQUIRED_SURFACE_PATTERNS.every((pattern) => pattern.test(text))) return

  throw new Error(
    'Zwayam verified public careers surface changed; review the public contract before promoting a real parser.',
  )
}

export const assertVerifiedInfoEdgeParentHandoff = (html = '') => {
  if (INFO_EDGE_PARENT_HANDOFF_PATTERN.test(normalizeText(html))) return

  throw new Error(
    'Zwayam verified Info Edge parent-careers handoff changed; review the public careers contract.',
  )
}

export const assertNoPublicJobsSurface = (html = '', careersUrl = CAREERS_URL) => {
  if (hasJobPostingMarkup(html)) {
    throw new Error(
      'Zwayam public careers surface now exposes JobPosting markup; promote a real parser.',
    )
  }

  const careersPage = new URL(careersUrl)
  const careersPath = normalizePathname(careersPage.pathname)
  const linkedUrls = extractLinkedUrls(html, careersUrl)

  const publicJobsHostUrl = linkedUrls.find((url) =>
    TRUSTED_JOBS_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname)),
  )

  if (publicJobsHostUrl) {
    throw new Error(
      `Zwayam public careers surface now exposes a public jobs surface via ${publicJobsHostUrl.toString()}.`,
    )
  }

  const sameOriginJobUrl = linkedUrls.find((url) => {
    if (url.origin !== careersPage.origin) return false

    const pathname = normalizePathname(url.pathname)
    if (pathname === careersPath && !url.search && !url.hash) return false

    return SAME_ORIGIN_JOB_PATH_PATTERNS.some((pattern) => pattern.test(pathname))
  })

  if (sameOriginJobUrl) {
    throw new Error(
      `Zwayam public careers surface now exposes a public jobs surface via ${sameOriginJobUrl.toString()}.`,
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

export const createZwayamScraper = () => ({
  async run({ fetchHtml = defaultFetchHtml } = {}) {
    const html = await fetchHtml(CAREERS_URL)

    assertVerifiedPublicCareersSurface(html)
    assertVerifiedInfoEdgeParentHandoff(html)
    assertNoPublicJobsSurface(html, CAREERS_URL)

    return createFailClosedSentinelScraper().run()
  },
})

export const run = async (options = {}) => createZwayamScraper().run(options)
