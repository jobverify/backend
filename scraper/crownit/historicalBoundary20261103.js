import { createFailClosedSentinelScraper } from './failClosedSentinel.js'

export const SOURCE = 'crownit'
export const COMPANY = 'Crownit'
export const OFFICIAL_BRAND = 'Crownit'
export const VERIFIED_ON = '2026-08-15'
export const CAREERS_URL = 'https://crownit.in/en/careers'
export const DISPOSITION =
  'verified-first-party-careers-surface-with-non-enumerable-apply-flow'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, August 15, 2026 that https://crownit.in/en/careers remained the live first-party Crownit careers surface reviewed for this workbook source, that it still presented a non-enumerable Apply for job flow rendered through Crownit\'s own contact component, and that it did not expose a stable exact-company public ATS or job inventory. The page now links to Crownit\'s LinkedIn company presence without surfacing a public jobs board, so this company-local scraper remains fail-closed and returns no jobs until a stable exact-company public openings flow is verified.'

const REQUIRED_SURFACE_PATTERNS = [
  /\bLooking for career opportunities with us\?/i,
  /\bOurs is a team honed by hard work, dedication and sheer will to become a champion\./i,
  /\bWe do not shy away from work tirelessly to inch closer to the future that we have envisioned for ourselves\./i,
  /\bWe are always on the lookout for like-minded individuals with strong work ethics and a passion to create something\./i,
  /\bIf our vision moves you too, come and join our awe-inspiring team\./i,
  /\bApply for job\b/i,
  /(?:Now you can earn Crowns when you refer your friends for our open positions!|Ipsos Research Private Limited)/i,
]

const APPLY_FLOW_PATTERNS = [
  /<app-contactus\b[^>]*\bcareer="2"[^>]*\bsource="career"/i,
  /<button[^>]*class="contact-btn"[^>]*>\s*Apply for job\s*<\/button>/i,
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
  /icims\.com$/i,
]

const SAME_ORIGIN_JOB_PATH_PATTERNS = [
  /^\/(?:[a-z]{2}\/)?career(?:\/|$)/i,
  /^\/(?:[a-z]{2}\/)?careers?(?:\/|$)/i,
  /^\/(?:[a-z]{2}\/)?jobs?(?:\/|$)/i,
  /^\/(?:[a-z]{2}\/)?positions?(?:\/|$)/i,
  /^\/(?:[a-z]{2}\/)?roles?(?:\/|$)/i,
  /^\/(?:[a-z]{2}\/)?openings?(?:\/|$)/i,
  /^\/(?:[a-z]{2}\/)?apply(?:\/|$)/i,
  /^\/(?:[a-z]{2}\/)?join-us(?:\/|$)/i,
  /^\/(?:[a-z]{2}\/)?work-with-us(?:\/|$)/i,
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

export const assertVerifiedPublicCareersSurface = (html = '') => {
  const text = normalizeText(html)

  if (REQUIRED_SURFACE_PATTERNS.every((pattern) => pattern.test(text))) return

  throw new Error(
    'Crownit verified public careers surface changed; review the public contract before promoting a real parser.',
  )
}

export const assertVerifiedNonEnumerableApplyFlow = (html = '') => {
  if (APPLY_FLOW_PATTERNS.every((pattern) => pattern.test(String(html)))) return

  throw new Error(
    'Crownit verified non-enumerable apply flow changed; review the public careers contract.',
  )
}

export const assertNoPublicJobsSurface = (html = '', careersUrl = CAREERS_URL) => {
  if (hasJobPostingMarkup(html)) {
    throw new Error(
      'Crownit public careers surface now exposes JobPosting markup; promote a real parser.',
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
      `Crownit public careers surface now exposes a public jobs surface via ${atsBoardUrl.toString()}.`,
    )
  }

  const linkedInJobsUrl = linkedUrls.find((url) => isPublicLinkedInJobsUrl(url))
  if (linkedInJobsUrl) {
    throw new Error(
      `Crownit public careers surface now exposes a public jobs surface via ${linkedInJobsUrl.toString()}.`,
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
      `Crownit public careers surface now exposes a public jobs surface via ${sameOriginJobUrl.toString()}.`,
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

export const createCrownitScraper = () => ({
  async run({ fetchHtml = defaultFetchHtml } = {}) {
    const html = await fetchHtml(CAREERS_URL)

    assertVerifiedPublicCareersSurface(html)
    assertVerifiedNonEnumerableApplyFlow(html)
    assertNoPublicJobsSurface(html, CAREERS_URL)

    return createFailClosedSentinelScraper().run()
  },
})

export const run = async (options = {}) => createCrownitScraper().run(options)
