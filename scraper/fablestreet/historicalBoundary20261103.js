import { createFailClosedSentinelScraper } from './failClosedSentinel.js'

export const SOURCE = 'fablestreet'
export const COMPANY = 'Fablestreet'
export const OFFICIAL_BRAND = 'FableStreet'
export const VERIFIED_ON = '2026-07-26'
export const CAREERS_URL = 'https://www.fablestreet.com/pages/about-us'
export const DISPOSITION =
  'verified-exact-name-official-public-surface-with-jobs-email-and-no-enumerable-public-jobs-contract'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Sunday, July 26, 2026 that https://www.fablestreet.com/pages/about-us remained the live exact-name FableStreet official public surface reviewed for workbook company Fablestreet, that the current storefront still exposes the direct jobs contact channel careers@fablestreet.com plus company contact details on the about page, and that the reviewed surface exposes no trustworthy enumerable public jobs contract, no first-party public job inventory, and no handoff to a stable public ATS or exact-company jobs board. This company-local scraper therefore stays fail-closed and returns no jobs until a stable exact-company public openings flow is verified.'

const REQUIRED_SURFACE_PATTERNS = [
  /\bAbout Us\b/i,
  /\bFind Your Best FIT\b/i,
  /\bCONTACT US\b/i,
  /\bFable Street Lifestyle Solutions Private Limited\b/i,
  /\bcare@fablestreet\.com\b/i,
  /\bcareers@fablestreet\.com\b/i,
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

const EXACT_COMPANY_HIRING_COPY_PATTERNS = [
  /\bcareers at fable\s*street\b/i,
  /\bfable\s*street careers\b/i,
  /\bjoin (?:the )?fable\s*street team\b/i,
  /\bwe(?:'|â€™)?re hiring at fable\s*street\b/i,
  /\bopen(?:ing|ings)? at fable\s*street\b/i,
  /\bwork at fable\s*street\b/i,
  /\blife at fable\s*street\b/i,
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
  const page = String(html)
  const text = normalizeText(html)

  if (
    /<title>\s*About Us\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.fablestreet\.com\/pages\/about-us["']/i.test(page)
    && REQUIRED_SURFACE_PATTERNS.every((pattern) => pattern.test(text))
  ) {
    return
  }

  throw new Error(
    'Fablestreet verified official public surface changed; review the public contract before promoting a real parser.',
  )
}

export const assertNoPublicJobsSurface = (html = '', careersUrl = CAREERS_URL) => {
  if (hasJobPostingMarkup(html)) {
    throw new Error(
      'Fablestreet public surface now exposes JobPosting markup; promote a real parser.',
    )
  }

  const text = normalizeText(html)
  const exactCompanyHiringCopy = EXACT_COMPANY_HIRING_COPY_PATTERNS.find((pattern) =>
    pattern.test(text),
  )
  if (exactCompanyHiringCopy) {
    throw new Error(
      'Fablestreet public surface now exposes exact-company hiring copy; review the public jobs surface.',
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
      `Fablestreet public surface now exposes a public jobs surface via ${atsBoardUrl.toString()}.`,
    )
  }

  const linkedInJobsUrl = linkedUrls.find((url) => isPublicLinkedInJobsUrl(url))
  if (linkedInJobsUrl) {
    throw new Error(
      `Fablestreet public surface now exposes a public jobs surface via ${linkedInJobsUrl.toString()}.`,
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
      `Fablestreet public surface now exposes a public jobs surface via ${sameOriginJobUrl.toString()}.`,
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

export const createFablestreetScraper = () => ({
  async run({ fetchHtml = defaultFetchHtml } = {}) {
    const html = await fetchHtml(CAREERS_URL)

    assertVerifiedOfficialPublicSurface(html)
    assertNoPublicJobsSurface(html, CAREERS_URL)

    return createFailClosedSentinelScraper().run()
  },
})

export const run = async (options = {}) => createFablestreetScraper().run(options)
