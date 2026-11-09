import { createFailClosedSentinelScraper } from './failClosedSentinel.js'

export const SOURCE = 'zestmoney'
export const COMPANY = 'ZestMoney'
export const OFFICIAL_BRAND = 'ZestMoney'
export const CAREERS_URL = 'https://www.zestmoney.in/join-us-1/'
export const ICIMS_HANDOFF_URL = 'https://careers-zestmoney.icims.com/'
export const DISPOSITION = 'verified-public-careers-surface-with-dead-external-icims-handoff'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 25, 2026 that https://www.zestmoney.in/join-us-1/ was the live official public careers surface reviewed for ZestMoney and that it exposed a SEE JOB OPENINGS handoff to https://careers-zestmoney.icims.com/. The linked iCIMS host and standard public search paths returned 404 instead of a trustworthy enumerable public jobs contract, so this company-local scraper stays fail-closed and returns no jobs until a stable first-party or trusted public openings surface is verified.'

const REQUIRED_SURFACE_PATTERNS = [
  /\bjoin the zestmoney team!?/i,
  /\bready to make a difference\??/i,
  /\bwork with people who bring out the best in you\b/i,
  /\bat zestmoney,\s*we are\b/i,
  /\bperks and benefits\b/i,
  /\bsee job openings\b/i,
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
  /icims\.com$/i,
]

const SAME_ORIGIN_JOB_PATH_PATTERNS = [
  /^\/jobs?(?:\/|$)/i,
  /^\/positions?(?:\/|$)/i,
  /^\/openings?(?:\/|$)/i,
  /^\/roles?(?:\/|$)/i,
  /^\/apply(?:\/|$)/i,
]

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

const normalizeAbsoluteUrl = (value) => {
  if (!value) return null

  try {
    return new URL(String(value)).toString()
  } catch {
    return null
  }
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
    'ZestMoney verified public careers surface changed; review the public contract before promoting a real parser.',
  )
}

export const extractVerifiedIcimsHandoffUrl = (html = '', pageUrl = CAREERS_URL) =>
  extractLinkedUrls(html, pageUrl)
    .map((url) => normalizeAbsoluteUrl(url))
    .find((url) => url === ICIMS_HANDOFF_URL) || null

export const assertVerifiedIcimsHandoff = (html = '', pageUrl = CAREERS_URL) => {
  if (extractVerifiedIcimsHandoffUrl(html, pageUrl) === ICIMS_HANDOFF_URL) return

  throw new Error(
    'ZestMoney verified iCIMS handoff changed; review the public careers contract.',
  )
}

export const assertNoPublicJobsSurface = (html = '', careersUrl = CAREERS_URL) => {
  if (hasJobPostingMarkup(html)) {
    throw new Error(
      'ZestMoney public careers surface now exposes JobPosting markup; promote a real parser.',
    )
  }

  const careersPage = new URL(careersUrl)
  const careersPath = normalizePathname(careersPage.pathname)
  const linkedUrls = extractLinkedUrls(html, careersUrl)

  const atsBoardUrl = linkedUrls.find((url) => {
    const absoluteUrl = normalizeAbsoluteUrl(url)
    if (absoluteUrl === ICIMS_HANDOFF_URL) return false

    return TRUSTED_ATS_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname))
  })

  if (atsBoardUrl) {
    throw new Error(
      `ZestMoney public careers surface now exposes a public jobs surface via ${atsBoardUrl.toString()}.`,
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
      `ZestMoney public careers surface now exposes a public jobs surface via ${sameOriginJobUrl.toString()}.`,
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

export const createZestMoneyScraper = () => ({
  async run({ fetchHtml = defaultFetchHtml } = {}) {
    const html = await fetchHtml(CAREERS_URL)

    assertVerifiedPublicCareersSurface(html)
    assertVerifiedIcimsHandoff(html, CAREERS_URL)
    assertNoPublicJobsSurface(html, CAREERS_URL)

    return createFailClosedSentinelScraper().run()
  },
})

export const run = async (options = {}) => createZestMoneyScraper().run(options)
