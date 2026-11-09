export const SOURCE = 'stackbox'
export const COMPANY = 'Stackbox'
export const HOMEPAGE_URL = 'https://www.stackbox.xyz/'
export const CAREERS_URL = 'https://www.stackbox.xyz/company'
export const BROKEN_ROUTE_URL = 'https://www.stackbox.xyz/untitled/about-us'
export const NOT_FOUND_CANONICAL_URL = 'https://www.stackbox.xyz/404'
export const DISPOSITION = 'verified-homepage-with-broken-company-route-sentinel'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, August 1, 2026 that https://www.stackbox.xyz/ was the live Stackbox homepage, and that the legacy /company route resolved to a branded 404 page at https://www.stackbox.xyz/untitled/about-us with canonical https://www.stackbox.xyz/404 rather than exposing a public careers or jobs inventory.'

const HOMEPAGE_TITLE_PATTERN =
  /<title[^>]*>\s*Stackbox\s*\|\s*Cloud WMS,\s*TMS,\s*OMS\s*&amp;\s*Route-to-Market Platform[^<]*<\/title>/i
const HOMEPAGE_CANONICAL_PATTERN =
  /<link\b[^>]+(?:rel=["']canonical["'][^>]+href=["']https:\/\/www\.stackbox\.xyz\/?["']|href=["']https:\/\/www\.stackbox\.xyz\/?["'][^>]+rel=["']canonical["'])[^>]*>/i
const HOMEPAGE_VISIBLE_SIGNAL_PATTERNS = [
  /\bLead the next fulfilment era\b/i,
  /\bWe are the premier supply chain SaaS partners for growing enterprises\b/i,
]
const BROKEN_ROUTE_TITLE_PATTERN = /<title[^>]*>\s*Stackbox\s*<\/title>/i
const BROKEN_ROUTE_CANONICAL_PATTERN =
  /<link\b[^>]+(?:rel=["']canonical["'][^>]+href=["']https:\/\/www\.stackbox\.xyz\/404["']|href=["']https:\/\/www\.stackbox\.xyz\/404["'][^>]+rel=["']canonical["'])[^>]*>/i
const PAGE_NOT_FOUND_PATTERN = /\bPage Not Found\b/i
const MOVED_PAGE_COPY_PATTERN =
  /\bThe page you are looking for doesn(?:'|&#39;|&apos;|&rsquo;|&#8217;)t exist or has been moved\b/i

const normalizeText = (value = '') =>
  String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&#x27;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()

const normalizePageUrl = (value = '') => {
  const normalized = String(value).trim().replace(/\/+$/, '')
  return normalized ? `${normalized}/` : ''
}

const resolvePageUrl = (page = {}, fallbackUrl) => page?.url || page?.finalUrl || fallbackUrl

export const hasVerifiedHomepage = (html = '') => {
  const rawHtml = String(html)
  const text = normalizeText(rawHtml)

  return /\bstackbox\b/i.test(text)
    && HOMEPAGE_CANONICAL_PATTERN.test(rawHtml)
    && HOMEPAGE_TITLE_PATTERN.test(rawHtml)
    && HOMEPAGE_VISIBLE_SIGNAL_PATTERNS.every((pattern) => pattern.test(text))
}

export const isVerifiedBrokenCompanyRoute = (page = {}, requestedUrl = CAREERS_URL) => {
  const rawHtml = String(page?.html ?? '')
  const text = normalizeText(rawHtml)
  const finalUrl = normalizePageUrl(resolvePageUrl(page, requestedUrl))

  return Number(page?.status) === 404
    && finalUrl === normalizePageUrl(BROKEN_ROUTE_URL)
    && BROKEN_ROUTE_TITLE_PATTERN.test(rawHtml)
    && BROKEN_ROUTE_CANONICAL_PATTERN.test(rawHtml)
    && PAGE_NOT_FOUND_PATTERN.test(text)
    && MOVED_PAGE_COPY_PATTERN.test(text)
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (compatible; Jobverify/1.0)',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const createStackboxScraper = () => ({
  async run({ fetchPage = defaultFetchPage, fetchHtml } = {}) {
    const getPage =
      typeof fetchHtml === 'function'
        ? async (url) => {
            const html = await fetchHtml(url)
            if (url === CAREERS_URL) {
              return {
                status: 404,
                url: BROKEN_ROUTE_URL,
                html,
              }
            }

            return {
              status: 200,
              url: HOMEPAGE_URL,
              html,
            }
          }
        : fetchPage

    const homepage = await getPage(HOMEPAGE_URL)
    if (!hasVerifiedHomepage(homepage.html)) {
      throw new Error(
        'Stackbox verified homepage no longer matches the trusted public brand surface.',
      )
    }

    const brokenCompanyRoute = await getPage(CAREERS_URL)
    if (!isVerifiedBrokenCompanyRoute(brokenCompanyRoute, CAREERS_URL)) {
      throw new Error(
        'Stackbox legacy company route no longer matches the verified branded 404 surface.',
      )
    }

    return []
  },
})

export const run = async (options = {}) => createStackboxScraper().run(options)
