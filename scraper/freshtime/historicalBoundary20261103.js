import { createFailClosedSentinelScraper } from './failClosedSentinel.js'

export const SOURCE = 'freshtime'
export const COMPANY = 'Freshtime'
export const OFFICIAL_BRAND = 'Freshtime UK Limited'
export const VERIFIED_ON = '2026-08-14'
export const CAREERS_URL =
  'https://www.greencore.com/ir-draft/why-invest-draft/strategy/freshtime/'
export const DISPOSITION =
  'verified-exact-company-official-greencore-surface-with-no-enumerable-public-jobs-contract'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, August 14, 2026 that the previously reviewed Greencore Freshtime route at https://www.greencore.com/ir-draft/why-invest-draft/strategy/freshtime/ now returns the first-party title "Page not found - Greencore" with standard Greencore navigation including Careers and Work With Greencore, and no replacement exact-company public jobs contract was identified. The legacy Freshtime UK Limited entity remains dissolved, so this scraper stays fail-closed and returns no jobs until a trustworthy exact-company public openings surface reappears.'

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
  /recruitee\.com/i,
  /darwinbox/i,
  /kekahire\.com/i,
  /freshteam\.com/i,
  /teamtailor\.com/i,
]

const SAME_ORIGIN_JOB_PATH_PATTERNS = [
  /^\/(?:career|careers|job|jobs|position|positions|role|roles|opening|openings)(?:\/|$)/i,
  /^\/(?:apply|join-us|work-with-us)(?:\/|$)/i,
]

const LINKEDIN_PUBLIC_JOBS_PATTERN =
  /^https?:\/\/(?:[\w-]+\.)?linkedin\.com\/(?:company\/[^/?#]+\/jobs|jobs\/(?:search|view))(?:\/|[?#]|$)/i
const EXACT_COMPANY_URL_SIGNAL = /\bfreshtime\b/i

const normalizeText = (html = '') =>
  String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()

const extractLinkedUrls = (html = '', pageUrl = CAREERS_URL) => {
  const urls = []

  for (const match of String(html).matchAll(
    /(?:href|src|action|data-url)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
  )) {
    try {
      urls.push(new URL(match[1] || match[2] || match[3] || '', pageUrl))
    } catch {
      // Keep malformed markup fail-closed.
    }
  }

  return urls
}

const hasJobPostingMarkup = (html = '') =>
  /<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?\bJobPosting\b[\s\S]*?<\/script>/i.test(
    html,
  )

const hasExactCompanyUrlSignal = (url) =>
  EXACT_COMPANY_URL_SIGNAL.test(
    [url.hostname, url.pathname, url.search, url.hash]
      .filter(Boolean)
      .join(' '),
  )

export const assertVerifiedOfficialPublicSurface = (html = '') => {
  const rawHtml = String(html)
  const text = normalizeText(rawHtml)

  if (
    /<title[^>]*>\s*Freshtime\s*[-|]\s*Greencore\s*<\/title>/i.test(rawHtml)
    && /\bFreshtime\b/i.test(text)
    && /\bGreencore\b/i.test(text)
    && /\bmeal salads\b/i.test(text)
    && /\bchilled snacking\b/i.test(text)
    && /\bBoston,? Lincolnshire\b/i.test(text)
  ) {
    return
  }

  if (
    /<title[^>]*>\s*Page not found\s*-\s*Greencore\s*<\/title>/i.test(rawHtml)
    && /\bPage not found\b/i.test(text)
    && /\bGreencore\b/i.test(text)
    && /\bCareers\b/i.test(text)
    && /\bWork With Greencore\b/i.test(text)
  ) {
    return
  }

  throw new Error(
    'Freshtime verified official public surface changed; review the public contract before promoting a parser.',
  )
}

export const assertNoPublicJobsSurface = (html = '', surfaceUrl = CAREERS_URL) => {
  if (hasJobPostingMarkup(html)) {
    throw new Error('Freshtime public surface now exposes JobPosting markup; promote a real parser.')
  }

  const page = new URL(surfaceUrl)
  const jobsUrl = extractLinkedUrls(html, surfaceUrl).find((url) => {
    if (TRUSTED_ATS_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname))) return true
    if (LINKEDIN_PUBLIC_JOBS_PATTERN.test(url.toString())) return true
    if (url.origin !== page.origin) return false
    if (!hasExactCompanyUrlSignal(url)) return false
    return SAME_ORIGIN_JOB_PATH_PATTERNS.some((pattern) => pattern.test(url.pathname))
  })

  if (jobsUrl) {
    throw new Error(`Freshtime public surface now exposes a public jobs surface via ${jobsUrl.toString()}.`)
  }
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (compatible; Jobverify/1.0)',
    },
  })

  return {
    status: response.status,
    html: await response.text(),
  }
}

export const createFreshtimeScraper = () => ({
  async run({ fetchHtml, fetchPage = defaultFetchPage } = {}) {
    const page = fetchHtml
      ? { status: 200, html: await fetchHtml(CAREERS_URL) }
      : await fetchPage(CAREERS_URL)
    const status = Number(page?.status ?? 200)
    const html = String(page?.html ?? '')

    if (status < 200 || status >= 400) {
      if (status !== 404) {
        throw new Error(`HTTP ${status} for ${CAREERS_URL}`)
      }
    }

    assertVerifiedOfficialPublicSurface(html)
    assertNoPublicJobsSurface(html, CAREERS_URL)

    return createFailClosedSentinelScraper().run()
  },
})

export const run = async (options = {}) => createFreshtimeScraper().run(options)
