import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'

import { createFailClosedSentinelScraper } from './failClosedSentinel.js'

export const SOURCE = 'zenohealth'
export const COMPANY = 'Zeno Health'
export const OFFICIAL_BRAND = 'Zeno Health'
export const CAREERS_URL = 'https://corporate.zeno.health/careers'
export const DISPOSITION = 'verified-first-party-shell-without-public-openings-flow'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, August 14, 2026 that https://corporate.zeno.health/careers now serves a generic first-party Zeno Health shell with the title "Zeno Health", the healthcare-brand meta description, and first-party runtime assets, but no longer exposes the earlier careers copy or LinkedIn openings handoff. No trustworthy public openings flow or ATS links were present in the fetched public contract, so this company-local scraper stays fail-closed and returns no jobs until a verifiable openings surface reappears.'

const LEGACY_REQUIRED_SURFACE_PATTERNS = [
  /\bHelping the world is perhaps the most rewarding way to grow in your career and life\b/i,
  /\bWork culture at Zeno Health\b/i,
  /\bJoin us\b/i,
]

const LINKEDIN_OPENINGS_COPY_PATTERN =
  /\bView our LinkedIn page for current openings\b/i

const CURRENT_SHELL_PATTERNS = [
  /<title>\s*Zeno Health\s*<\/title>/i,
  /Zeno Health is a healthcare brand that makes medicines affordable and accessible to all/i,
  /<meta\s+property="og:url"\s+content="https:\/\/zeno\.health">/i,
  /(?:href|src)="[^"]*runtime\.js"/i,
  /(?:href|src)="[^"]*main\.js"/i,
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

const isCurrentVerifiedShell = (html = '') =>
  CURRENT_SHELL_PATTERNS.every((pattern) => pattern.test(String(html)))

export const assertVerifiedPublicCareersSurface = (html = '') => {
  const text = normalizeText(html)

  if (LEGACY_REQUIRED_SURFACE_PATTERNS.every((pattern) => pattern.test(text))) return
  if (isCurrentVerifiedShell(html)) return

  throw new Error(
    'Zeno Health verified public careers surface changed; review the public contract before promoting a real parser.',
  )
}

export const assertVerifiedLinkedInOpeningsHandoff = (html = '') => {
  if (isCurrentVerifiedShell(html)) return
  if (LINKEDIN_OPENINGS_COPY_PATTERN.test(normalizeText(html))) return

  throw new Error(
    'Zeno Health verified LinkedIn openings handoff changed; review the public careers contract.',
  )
}

export const assertNoPublicJobsSurface = (html = '', careersUrl = CAREERS_URL) => {
  if (hasJobPostingMarkup(html)) {
    throw new Error(
      'Zeno Health public careers surface now exposes JobPosting markup; promote a real parser.',
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
      `Zeno Health public careers surface now exposes a public jobs surface via ${atsBoardUrl.toString()}.`,
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
      `Zeno Health public careers surface now exposes a public jobs surface via ${sameOriginJobUrl.toString()}.`,
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

const defaultFetchBrowserHtml = async (url) => {
  const session = await createBrowserFetchSession({
    waitUntil: 'domcontentloaded',
    settleTimeMs: 5000,
    timeoutMs: 90000,
    ignoreHTTPSErrors: false,
  })

  try {
    const page = await session.fetchPage(url)
    if (page.status < 200 || page.status >= 400) {
      throw new Error(`HTTP ${page.status} for ${url}`)
    }

    return page.html
  } finally {
    await session.close()
  }
}

const assertVerifiedContract = (html = '') => {
  assertVerifiedPublicCareersSurface(html)
  assertVerifiedLinkedInOpeningsHandoff(html)
  assertNoPublicJobsSurface(html, CAREERS_URL)
}

export const createZenoHealthScraper = () => ({
  async run({ fetchHtml = defaultFetchHtml, fetchBrowserHtml = defaultFetchBrowserHtml } = {}) {
    let html

    try {
      html = await fetchHtml(CAREERS_URL)
      assertVerifiedContract(html)
    } catch {
      html = await fetchBrowserHtml(CAREERS_URL)
      assertVerifiedContract(html)
    }

    return createFailClosedSentinelScraper().run()
  },
})

export const run = async (options = {}) => createZenoHealthScraper().run(options)
