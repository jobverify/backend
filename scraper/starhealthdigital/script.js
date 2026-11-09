export const SOURCE = 'starhealthdigital'
export const COMPANY = 'StarHealth Digital'
export const CAREERS_URL = 'https://www.starhealth.in/careers/'
export const EXPLORE_JOB_OPPORTUNITIES_CTA = 'Explore job opportunities'
export const DISPOSITION = 'verified-non-enumerable-careers-cta'

const REQUIRED_COPY_PATTERNS = [
  /get hired and take the next\s*step in your career/i,
  /\bexplore job opportunities\b/i,
  /\bwhy star health\b/i,
]

const LISTING_HEADLINE_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bopen roles\b/i,
  /\bavailable positions\b/i,
  /\bview opportunities\b/i,
  /\bsearch jobs\b/i,
]

const LIKELY_JOB_PATHS = [
  /^\/careers\/[^/?#]+$/i,
  /^\/jobs?(?:\/|$)/i,
  /^\/positions?(?:\/|$)/i,
  /^\/roles?(?:\/|$)/i,
  /^\/openings?(?:\/|$)/i,
  /^\/apply(?:\/|$)/i,
]

const ONCLICK_URL_PATTERNS = [
  /(?:window\.)?location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/gi,
  /location\.assign\(\s*['"]([^'"]+)['"]\s*\)/gi,
  /window\.open\(\s*['"]([^'"]+)['"]/gi,
  /router\.push\(\s*['"]([^'"]+)['"]\s*\)/gi,
]

const decodeEntities = (value) =>
  String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")

const normalizeText = (value) =>
  decodeEntities(String(value))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizePathname = (value) => {
  const normalized = String(value || '').trim().replace(/\/+$/, '')
  return normalized || '/'
}

const dedupe = (values) => {
  const seen = new Set()
  const result = []

  for (const value of values) {
    if (!value || seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }

  return result
}

const resolveUrl = (value, baseUrl = CAREERS_URL) => {
  if (!value) return null

  try {
    return new URL(decodeEntities(value), baseUrl).toString()
  } catch {
    return null
  }
}

const extractAttributeValue = (attributes = '', attributeName) => {
  const pattern = new RegExp(
    `${attributeName}\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))`,
    'i',
  )
  const match = String(attributes).match(pattern)
  return match ? match[1] || match[2] || match[3] || null : null
}

const containsJobPostingMarkup = (html = '') => {
  const blocks = String(html).matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )

  for (const block of blocks) {
    if (/\bJobPosting\b/i.test(block[1])) return true
  }

  return false
}

const extractSameOriginLinks = (html = '', pageUrl = CAREERS_URL) => {
  const baseUrl = new URL(pageUrl)
  const links = new Set()
  const matches = String(html).matchAll(
    /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>/gi,
  )

  for (const match of matches) {
    const href = match[1] || match[2] || match[3] || null
    if (!href) continue

    try {
      const url = new URL(decodeEntities(href), baseUrl)
      if (url.origin === baseUrl.origin) links.add(url.toString())
    } catch {
      // Ignore malformed URLs and keep the scraper fail-closed.
    }
  }

  return [...links]
}

const extractExploreCtaTargets = (html = '', pageUrl = CAREERS_URL) => {
  const targets = []

  for (const match of String(html).matchAll(
    /<a\b([^>]*)>([\s\S]*?)<\/a>|<button\b([^>]*)>([\s\S]*?)<\/button>/gi,
  )) {
    const attributes = match[1] || match[3] || ''
    const label = normalizeText(match[2] || match[4] || '')

    if (!/\bexplore job opportunities\b/i.test(label)) continue

    for (const attributeName of ['href', 'data-href', 'data-url', 'data-link', 'formaction']) {
      const target = resolveUrl(extractAttributeValue(attributes, attributeName), pageUrl)
      if (target) targets.push(target)
    }

    const onclick = extractAttributeValue(attributes, 'onclick')
    if (!onclick) continue

    for (const pattern of ONCLICK_URL_PATTERNS) {
      for (const onclickMatch of onclick.matchAll(pattern)) {
        const target = resolveUrl(onclickMatch[1], pageUrl)
        if (target) targets.push(target)
      }
    }
  }

  return dedupe(targets)
}

const isFirstPartyListingsSurface = (value, careersUrl = CAREERS_URL) => {
  if (!value) return false

  try {
    const target = new URL(value, careersUrl)
    const careersPage = new URL(careersUrl)

    if (target.origin !== careersPage.origin) return false

    const targetPath = normalizePathname(target.pathname)
    const careersPath = normalizePathname(careersPage.pathname)

    if (targetPath === careersPath && !target.search && !target.hash) return false

    return LIKELY_JOB_PATHS.some((pattern) => pattern.test(targetPath))
  } catch {
    return false
  }
}

const findPublicListingSignals = (html = '', careersUrl = CAREERS_URL) => {
  const text = normalizeText(html)
  const sameOriginLinks = extractSameOriginLinks(html, careersUrl)
  const exploreCtaTargets = extractExploreCtaTargets(html, careersUrl)
  const listingLinks = dedupe(
    [...sameOriginLinks, ...exploreCtaTargets].filter((value) =>
      isFirstPartyListingsSurface(value, careersUrl),
    ),
  )

  return {
    hasJobPostingMarkup: containsJobPostingMarkup(html),
    hasListingHeadline: LISTING_HEADLINE_PATTERNS.some((pattern) => pattern.test(text)),
    listingLinks,
  }
}

const assertVerifiedContract = (html = '', careersUrl = CAREERS_URL) => {
  const text = normalizeText(html)

  if (!REQUIRED_COPY_PATTERNS.every((pattern) => pattern.test(text))) {
    throw new Error(
      'StarHealth Digital careers contract changed: missing verified careers hero copy.',
    )
  }

  const listingSignals = findPublicListingSignals(html, careersUrl)

  if (listingSignals.hasJobPostingMarkup) {
    throw new Error(
      'StarHealth Digital careers surface now exposes JobPosting markup; promote a real parser.',
    )
  }

  if (!listingSignals.hasListingHeadline && listingSignals.listingLinks.length === 0) return

  throw new Error(
    `StarHealth Digital careers surface now exposes a first-party public listings surface: ${listingSignals.listingLinks.join(', ') || 'listing headline detected'}`,
  )
}

export const createStarHealthDigitalScraper = ({ careersUrl = CAREERS_URL } = {}) => ({
  async run({ fetchHtml = defaultFetchHtml } = {}) {
    const html = await fetchHtml(careersUrl)
    assertVerifiedContract(html, careersUrl)
    return []
  },
})

export const run = async (options = {}) => createStarHealthDigitalScraper().run(options)

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
