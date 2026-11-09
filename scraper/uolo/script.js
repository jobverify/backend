export const SOURCE = 'uolo'
export const COMPANY = 'Uolo'
export const CAREERS_URL = 'https://www.uolo.com/'
export const LINKEDIN_COMPANY_URL = 'https://www.linkedin.com/company/uolo/jobs/'
export const DISPOSITION =
  'verified-exact-name-public-company-surface-with-linkedin-handoff'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 25, 2026 that https://www.uolo.com/ was the live Uolo exact-name public company surface and that its Careers footer handed off to LinkedIn instead of exposing a stable first-party jobs inventory. This provider stays fail-closed until a stable exact-name public jobs surface is promoted.'

const REQUIRED_SURFACE_PATTERNS = [
  /\bUolo revolutionises the school system with learning programs\b/i,
  /\bGet in touch with us\b/i,
  /\bUolo EdTech Private Limited\b/i,
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
  /darwinbox/i,
  /kekahire\.com/i,
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

const LINKEDIN_HANDOFF_PATTERN =
  /^https?:\/\/(?:www|in)\.linkedin\.com\/company\/uolo(?:\/jobs\/?)?(?:[?#].*)?$/i

const decodeEntities = (value = '') =>
  String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")

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

const extractAnchors = (html = '', pageUrl = CAREERS_URL) => {
  const anchors = []
  const matches = String(html).matchAll(
    /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi,
  )

  for (const match of matches) {
    const rawHref = match[1] || match[2] || match[3] || ''
    const text = normalizeText(match[4] || '')

    try {
      anchors.push({
        url: new URL(decodeEntities(rawHref), pageUrl),
        text,
      })
    } catch {
      // Ignore malformed anchors and keep the sentinel fail-closed.
    }
  }

  return anchors
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

const assertVerifiedExactNameSurface = (html = '') => {
  const text = normalizeText(html)

  if (REQUIRED_SURFACE_PATTERNS.every((pattern) => pattern.test(text))) return

  throw new Error(
    'Uolo verified exact-name public company surface changed; review the public contract before promoting a real parser.',
  )
}

const assertVerifiedLinkedInHandoff = (html = '', pageUrl = CAREERS_URL) => {
  const handoff = extractAnchors(html, pageUrl).find(
    ({ url, text }) =>
      /\bcareers\b/i.test(text) && LINKEDIN_HANDOFF_PATTERN.test(url.toString()),
  )

  if (handoff) return

  throw new Error(
    'Uolo verified LinkedIn careers handoff changed; review the first-party careers contract.',
  )
}

const assertNoPublicJobsSurface = (html = '', careersUrl = CAREERS_URL) => {
  if (hasJobPostingMarkup(html)) {
    throw new Error(
      'Uolo public company surface now exposes JobPosting markup; promote a real parser.',
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
      `Uolo public company surface now exposes a public jobs surface via ${atsBoardUrl.toString()}.`,
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
      `Uolo public company surface now exposes a public jobs surface via ${sameOriginJobUrl.toString()}.`,
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

export const createUoloScraper = () => ({
  async run({ fetchHtml = defaultFetchHtml } = {}) {
    const html = await fetchHtml(CAREERS_URL)

    assertVerifiedExactNameSurface(html)
    assertVerifiedLinkedInHandoff(html, CAREERS_URL)
    assertNoPublicJobsSurface(html, CAREERS_URL)

    return []
  },
})

export const run = async (options = {}) => createUoloScraper().run(options)
