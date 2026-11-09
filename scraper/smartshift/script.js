export const SOURCE = 'smartshift'
export const COMPANY = 'Smartshift'
export const OFFICIAL_BRAND = 'Smartshift'
export const CAREERS_URL = 'https://www.smartshiftnow.com/'
export const DISPOSITION = 'verified-public-company-surface-fail-closed-sentinel'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 25, 2026 that https://www.smartshiftnow.com/ was the live first-party public surface reviewed for Smartshift. This batch only pins the exact workbook name to the verified public company surface, and no batch-04 company-specific openings parser has been promoted yet, so the provider remains fail-closed and returns no jobs until a verifiable public openings flow is implemented.'

const REQUIRED_BRAND_PATTERN = /\bsmartshift\b/i
const TITLE_BRAND_PATTERN = /<title[^>]*>[\s\S]*?\bsmartshift\b[\s\S]*?<\/title>/i
const CANONICAL_SURFACE_PATTERN =
  /<(?:link|meta)\b[^>]+(?:href|content)=["']https:\/\/www\.(?:smartshiftnow|smartshift)\.com\/?["'][^>]*>/i

const LISTING_COPY_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bjob openings\b/i,
  /\bopen positions\b/i,
  /\bopen roles\b/i,
  /\bview jobs\b/i,
  /\bsearch jobs\b/i,
  /\bjoin our team\b/i,
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
  /zohorecruit\.in/i,
  /teamtailor\.com/i,
  /darwinbox/i,
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
      // Ignore malformed URLs and keep the sentinel fail-closed.
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

export const hasVerifiedCompanySurface = (html = '') => {
  const rawHtml = String(html)
  const text = normalizeText(rawHtml)

  return REQUIRED_BRAND_PATTERN.test(text)
    && TITLE_BRAND_PATTERN.test(rawHtml)
    && CANONICAL_SURFACE_PATTERN.test(rawHtml)
}

export const detectPublicJobsSurface = (html = '', careersUrl = CAREERS_URL) => {
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
    'Smartshift verified public company surface no longer matches the local contract.',
  )
}

export const createSmartshiftScraper = ({ careersUrl = CAREERS_URL } = {}) => ({
  async run({ fetchHtml = defaultFetchHtml } = {}) {
    const html = await fetchHtml(careersUrl)
    assertVerifiedCompanySurface(html)

    const publicJobsSurface = detectPublicJobsSurface(html, careersUrl)
    if (publicJobsSurface) {
      throw new Error(
        `Smartshift public jobs surface changed materially: ${publicJobsSurface}`,
      )
    }

    return []
  },
})

export const run = async (options = {}) => createSmartshiftScraper().run(options)

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
