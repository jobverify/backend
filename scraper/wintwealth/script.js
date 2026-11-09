export const SOURCE = 'wintwealth'
export const COMPANY = 'Wint Wealth'
export const OFFICIAL_BRAND = 'Wint Wealth'
export const CAREERS_URL = 'https://www.wintwealth.com/about-us/'
export const DISPOSITION = 'verified-exact-name-public-company-surface'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 25, 2026 that https://www.wintwealth.com/about-us/ was the live Wint Wealth exact-name public company surface reviewed for Wint Wealth and that it exposed no trustworthy public careers or jobs inventory. This provider stays fail-closed until Wint Wealth publishes a stable exact-name public openings surface.'

const REQUIRED_TEXT_PATTERNS = [
  /\bwint wealth\b/i,
  /\bour co-founders\b/i,
  /\busers trust wint wealth\b/i,
  /\bsebi registered broker\b/i,
  /hello@wintwealth\.com/i,
]

const LISTING_COPY_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bopen roles\b/i,
  /\bavailable positions\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
  /\bcareer opportunities\b/i,
  /\bjoin our team\b/i,
  /\bwe(?:'|)re hiring\b/i,
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
  /teamtailor\.com/i,
  /keka\.com/i,
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

export const hasVerifiedCompanySurface = (html = '') => {
  const text = normalizeText(html)
  return REQUIRED_TEXT_PATTERNS.every((pattern) => pattern.test(text))
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
    'Wint Wealth verified public company surface no longer matches the exact-name contract.',
  )
}

export const createWintWealthScraper = ({ careersUrl = CAREERS_URL } = {}) => ({
  async run({ fetchHtml = defaultFetchHtml } = {}) {
    const html = await fetchHtml(careersUrl)
    assertVerifiedCompanySurface(html)

    const publicJobsSurface = detectPublicJobsSurface(html, careersUrl)
    if (publicJobsSurface) {
      throw new Error(
        `Wint Wealth public jobs surface changed materially: ${publicJobsSurface}`,
      )
    }

    return []
  },
})

export const run = async (options = {}) => createWintWealthScraper().run(options)

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
