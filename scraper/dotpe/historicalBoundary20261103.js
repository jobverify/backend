import { createFailClosedSentinelScraper } from './failClosedSentinel.js'

export const SOURCE = 'dotpe'
export const COMPANY = 'DotPe'
export const OFFICIAL_BRAND = 'DotPe'
export const VERIFIED_ON = '2026-07-25'
export const CAREERS_URL = 'https://dotpe.in/careers.html'
export const DISPOSITION =
  'verified-first-party-careers-surface-with-non-navigating-open-roles-ctas'
export const VERIFIED_SURFACE_SUMMARY =
  "Verified on Saturday, July 25, 2026 that https://dotpe.in/careers.html was the live exact-company DotPe careers page, that its View Open Roles and See Openings CTAs were both non-navigating # anchors, and that its We're hiring search form exposed only the placeholder Search Jobs, Enter Keyword plus a Search all Jobs submit control with no actionable public search endpoint. No trustworthy enumerable public jobs contract was verified for DotPe, so this company-local scraper stays fail-closed until DotPe exposes a stable first-party or officially handed-off public openings flow."

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify/1.0)'

const REQUIRED_SURFACE_PATTERNS = [
  /<title[^>]*>\s*DotPe\s*<\/title>/i,
  /\bWork at Dotpe\b/i,
  /\bBuild something exciting\./i,
  /\breimagine the future of commerce in India\b/i,
  /\bValue that we seek in our people and cultivate in our culture\./i,
  /\bAWESOMENESS IN THEIR DNA\b/i,
  /\bCUSTOMER OBSESSION\b/i,
  /\bA FUNNY BONE\b/i,
  /\bWe(?:\u2019|')re hiring\b/i,
]

const VERIFIED_CTA_TARGETS = {
  viewOpenRoles: '#',
  seeOpenings: '#',
}

const VERIFIED_SEARCH_FORM_CONTRACT = {
  action: null,
  method: 'GET',
  placeholder: 'Search Jobs, Enter Keyword',
  submitLabel: 'Search all Jobs',
}

const ATS_HOST_PATTERNS = [
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

const LINKEDIN_JOBS_PATTERN =
  /^https?:\/\/(?:www|in)\.linkedin\.com\/(?:company\/[^/?#]+\/jobs|jobs\/search)/i

const SAME_ORIGIN_JOB_PATH_PATTERNS = [
  /^\/jobs?(?:\/|$)/i,
  /^\/careers?(?:\/|$)/i,
  /^\/career(?:\/|$)/i,
  /^\/positions?(?:\/|$)/i,
  /^\/openings?(?:\/|$)/i,
  /^\/roles?(?:\/|$)/i,
  /^\/apply(?:\/|$)/i,
  /^\/join-us(?:\/|$)/i,
]

const decodeEntities = (value = '') =>
  String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#8212;|&mdash;/gi, '-')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeEntities(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeText = (value = '') =>
  normalizeWhitespace(
    String(value)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  ) || ''

const normalizePathname = (value = '') => {
  const normalized = String(value).trim().replace(/\/+$/, '')
  return normalized || '/'
}

const normalizeAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const normalizeHrefTarget = (value = '') => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return normalized
}

const normalizeActionValue = (value = '') => {
  const normalized = normalizeWhitespace(value)
  if (!normalized || normalized === '#') return null
  return normalized
}

const extractAnchors = (html = '') =>
  [...String(html).matchAll(
    /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi,
  )]
    .map((match) => {
      const rawHref = match[1] || match[2] || match[3] || ''
      const text = normalizeText(match[4] || '')
      if (!text) return null

      return {
        href: normalizeHrefTarget(rawHref),
        text,
      }
    })
    .filter(Boolean)

const extractForms = (html = '') =>
  [...String(html).matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)].map((match) => ({
    attributes: match[1] || '',
    body: match[2] || '',
  }))

const extractAttribute = (rawAttributes = '', attributeName) =>
  normalizeWhitespace(
    rawAttributes.match(
      new RegExp(`${attributeName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'),
    )?.slice(1).find(Boolean) || '',
  ) || null

const hasJobPostingMarkup = (html = '') => {
  const blocks = String(html).matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )

  for (const block of blocks) {
    if (/\bJobPosting\b/i.test(block[1])) return true
  }

  return false
}

const extractLinkedUrls = (html = '', pageUrl = CAREERS_URL) => {
  const urls = []
  const matches = String(html).matchAll(
    /(?:href|src|action|data-url)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
  )

  for (const match of matches) {
    const rawValue = match[1] || match[2] || match[3] || ''
    const absoluteUrl = normalizeAbsoluteUrl(rawValue, pageUrl)

    if (!absoluteUrl) continue
    urls.push(new URL(absoluteUrl))
  }

  return urls
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html)
  const text = normalizeText(page)

  return REQUIRED_SURFACE_PATTERNS.every((pattern) => pattern.test(page) || pattern.test(text))
}

export const extractCareerCtaTargets = (html = '') => {
  const targets = {
    viewOpenRoles: null,
    seeOpenings: null,
  }

  for (const anchor of extractAnchors(html)) {
    if (/^view open roles$/i.test(anchor.text)) {
      targets.viewOpenRoles = anchor.href
    }

    if (/^see openings$/i.test(anchor.text)) {
      targets.seeOpenings = anchor.href
    }
  }

  return targets
}

export const extractSearchFormContract = (html = '') => {
  for (const form of extractForms(html)) {
    const placeholder = normalizeWhitespace(
      form.body.match(/<input\b[^>]*placeholder\s*=\s*(?:"([^"]*)"|'([^']*)')/i)
        ?.slice(1)
        .find(Boolean) || '',
    )
    const submitLabel = normalizeText(
      form.body.match(/<button\b[^>]*type\s*=\s*["']submit["'][^>]*>([\s\S]*?)<\/button>/i)?.[1]
        || '',
    )

    if (!placeholder && !submitLabel) continue

    return {
      action: normalizeActionValue(extractAttribute(form.attributes, 'action')),
      method:
        normalizeWhitespace(extractAttribute(form.attributes, 'method'))?.toUpperCase() || 'GET',
      placeholder,
      submitLabel,
    }
  }

  return {
    action: null,
    method: 'GET',
    placeholder: null,
    submitLabel: null,
  }
}

export const assertVerifiedPublicCareersSurface = (html = '') => {
  if (hasOfficialCareersPageSignal(html)) return

  throw new Error(
    'DotPe verified official careers surface changed; review the public contract before promoting a real parser.',
  )
}

export const assertVerifiedCtaContract = (html = '') => {
  const actual = extractCareerCtaTargets(html)

  if (JSON.stringify(actual) === JSON.stringify(VERIFIED_CTA_TARGETS)) return

  throw new Error(
    'DotPe verified CTA contract changed; review whether a trustworthy public jobs surface now exists.',
  )
}

export const assertVerifiedSearchFormContract = (html = '') => {
  const actual = extractSearchFormContract(html)

  if (JSON.stringify(actual) === JSON.stringify(VERIFIED_SEARCH_FORM_CONTRACT)) return

  throw new Error(
    'DotPe verified search form contract changed; review whether a trustworthy public jobs surface now exists.',
  )
}

export const assertNoUnexpectedPublicJobsSurface = (html = '', careersUrl = CAREERS_URL) => {
  if (hasJobPostingMarkup(html)) {
    throw new Error(
      'DotPe public careers surface now exposes JobPosting markup; review whether a real parser should replace the fail-closed scraper.',
    )
  }

  const careersPage = new URL(careersUrl)
  const careersPath = normalizePathname(careersPage.pathname)
  const linkedUrls = extractLinkedUrls(html, careersUrl)

  const atsBoardUrl = linkedUrls.find((url) =>
    ATS_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname))
      || LINKEDIN_JOBS_PATTERN.test(url.toString()),
  )
  if (atsBoardUrl) {
    throw new Error(
      `DotPe public careers surface now exposes a public jobs surface via ${atsBoardUrl.toString()}.`,
    )
  }

  const sameOriginPublicJobsUrl = linkedUrls.find((url) => {
    if (url.origin !== careersPage.origin) return false

    const pathname = normalizePathname(url.pathname)
    if (pathname === careersPath && !url.search) return false

    return SAME_ORIGIN_JOB_PATH_PATTERNS.some((pattern) => pattern.test(pathname))
  })
  if (sameOriginPublicJobsUrl) {
    throw new Error(
      `DotPe public careers surface now exposes a public jobs surface via ${sameOriginPublicJobsUrl.toString()}.`,
    )
  }
}

const defaultFetchHtml = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': USER_AGENT,
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

export const createDotPeScraper = () => ({
  async run({ fetchHtml = defaultFetchHtml } = {}) {
    const html = await fetchHtml(CAREERS_URL)

    assertVerifiedPublicCareersSurface(html)
    assertVerifiedCtaContract(html)
    assertVerifiedSearchFormContract(html)
    assertNoUnexpectedPublicJobsSurface(html, CAREERS_URL)

    return createFailClosedSentinelScraper().run()
  },
})

export const run = async (options = {}) => createDotPeScraper().run(options)
