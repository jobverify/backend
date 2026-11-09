import { createFailClosedSentinelScraper } from './failClosedSentinel.js'

export const SOURCE = 'blaaiz'
export const COMPANY = 'Blaaiz'
export const OFFICIAL_BRAND = 'Blaaiz'
export const CAREERS_URL = 'https://www.blaaiz.com/about-us'
export const DISPOSITION =
  'verified-exact-name-official-public-surface-with-no-trustworthy-jobs-contract'
export const VERIFIED_SURFACE_SUMMARY =
  "Verified on Saturday, August 1, 2026 that https://www.blaaiz.com/about-us was the live exact-name Blaaiz official public surface reviewed for this workbook source. The reviewed surface exposed the current fraud-prevention lead copy, Global Financial Infrastructure vision and mission copy, support and sales contact channels, and sign-up calls to action, but no trustworthy exact-company careers page, no trustworthy enumerable public jobs contract, and no first-party handoff to a stable public ATS or company jobs board. This company-local scraper therefore stays fail-closed and returns no jobs until a stable exact-company public openings flow is verified."

const REQUIRED_SURFACE_PATTERNS = [
  /\bAbout Us\b/i,
  /\bFraudsters don(?:'|’|&#x27;)t sleep,\s*neither do we\./i,
  /\bGlobal Financial Infrastructure\b/i,
  /\bSolving Problems Markets Won(?:'|’|&#x27;)t Solve\b/i,
  /\bEnabling Mobility and Prosperity Through Cross-Border Infrastructure\b/i,
  /\bsupport@blaaiz\.com\b/i,
  /\bsales@blaaiz\.com\b/i,
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
  /freshteam\.com/i,
  /teamtailor\.com/i,
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
  /^\/work-with-us(?:\/|$)/i,
]

const LINKEDIN_PUBLIC_JOBS_PATTERNS = [
  /^https?:\/\/(?:[\w-]+\.)?linkedin\.com\/company\/[^/?#]+\/jobs(?:\/|[?#]|$)/i,
  /^https?:\/\/(?:[\w-]+\.)?linkedin\.com\/jobs\/search\/?(?:[?#].*)?$/i,
  /^https?:\/\/(?:[\w-]+\.)?linkedin\.com\/jobs\/view\/[^?#]+(?:[?#].*)?$/i,
]

const decodeEntities = (value = '') =>
  String(value)
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;|&rsquo;|&#8217;/gi, "'")

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

const isPublicLinkedInJobsUrl = (url) =>
  LINKEDIN_PUBLIC_JOBS_PATTERNS.some((pattern) => pattern.test(url.toString()))

export const assertVerifiedOfficialPublicSurface = (html = '') => {
  const text = normalizeText(html)

  const currentIdentity = /<title>\s*About Blaaiz \| Cross-Border Payment Platform\s*<\/title>/i.test(html)
    && /<link[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/www\.blaaiz\.com\/about-us["']/i.test(html)
  // The current verified about page removes only the former fraud-prevention lead.
  if (REQUIRED_SURFACE_PATTERNS.every((pattern, index) => pattern.test(text) || (index === 1 && currentIdentity))) return

  throw new Error(
    'Blaaiz verified official public surface changed; review the public contract before promoting a real parser.',
  )
}

export const assertNoPublicJobsSurface = (html = '', careersUrl = CAREERS_URL) => {
  if (hasJobPostingMarkup(html)) {
    throw new Error(
      'Blaaiz public surface now exposes JobPosting markup; promote a real parser.',
    )
  }

  const careersPage = new URL(careersUrl)
  const careersPath = normalizePathname(careersPage.pathname)
  const linkedUrls = extractLinkedUrls(html, careersUrl)

  const atsBoardUrl = linkedUrls.find((url) =>
    TRUSTED_ATS_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname)),
  )
  if (atsBoardUrl) {
    throw new Error(
      `Blaaiz public surface now exposes a public jobs surface via ${atsBoardUrl.toString()}.`,
    )
  }

  const linkedInJobsUrl = linkedUrls.find((url) => isPublicLinkedInJobsUrl(url))
  if (linkedInJobsUrl) {
    throw new Error(
      `Blaaiz public surface now exposes a public jobs surface via ${linkedInJobsUrl.toString()}.`,
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
      `Blaaiz public surface now exposes a public jobs surface via ${sameOriginJobUrl.toString()}.`,
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

export const createBlaaizScraper = () => ({
  async run({ fetchHtml = defaultFetchHtml } = {}) {
    const html = await fetchHtml(CAREERS_URL)

    assertVerifiedOfficialPublicSurface(html)
    assertNoPublicJobsSurface(html, CAREERS_URL)

    return createFailClosedSentinelScraper().run()
  },
})

export const run = async (options = {}) => createBlaaizScraper().run(options)
