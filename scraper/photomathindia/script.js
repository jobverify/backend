export const SOURCE = 'photomathindia'
export const COMPANY = 'Photomath India'
export const OFFICIAL_BRAND = 'Photomath'
export const HOMEPAGE_URL = 'https://www.photomath.com/'
export const CAREERS_URL = 'https://www.photomath.com/careers/'
export const GOOGLE_CAREERS_URL = 'https://www.google.com/about/careers/applications/'
export const DISPOSITION = 'verified-company-surface-with-google-careers-handoff'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, August 1, 2026 that https://www.photomath.com/ was the live Photomath brand surface and that its /careers/ route redirected to the generic Google Careers applications hub rather than an exact-company public jobs inventory for Photomath India.'

const REQUIRED_BRAND_PATTERN = /\bphotomath\b/i
const TITLE_BRAND_PATTERN = /<title[^>]*>[\s\S]*?\bphotomath\b[\s\S]*?<\/title>/i
const CANONICAL_SURFACE_PATTERN =
  /<(?:link|meta)\b[^>]+(?:href|content)=["']https:\/\/(?:www\.)?photomath\.com\/["'][^>]*>/i

const GOOGLE_CAREERS_TITLE_PATTERN = /<title[^>]*>\s*Search for your career at Google\.\s*<\/title>/i
const GOOGLE_CAREERS_SIGNAL_PATTERNS = [
  /\bHow we hire\b/i,
  /\bEqual Opportunity Google\b/i,
  /\bJobs\b/i,
  /\bStudents\b/i,
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

const resolvePageUrl = (page = {}, fallbackUrl) => page?.url || page?.finalUrl || fallbackUrl

export const extractCareersHandoffUrl = (html = '') => {
  const rawHtml = String(html)
  const directMatch = rawHtml.match(/href=["'](https:\/\/www\.photomath\.com\/careers\/)["']/i)?.[1]
  if (directMatch) return directMatch

  const relativeMatch = rawHtml.match(/href=["'](\/careers\/)["']/i)?.[1]
  return relativeMatch ? new URL(relativeMatch, HOMEPAGE_URL).toString() : null
}

export const hasVerifiedCompanySurface = (html = '') => {
  const rawHtml = String(html)
  const text = normalizeText(rawHtml)

  return REQUIRED_BRAND_PATTERN.test(text)
    && TITLE_BRAND_PATTERN.test(rawHtml)
    && CANONICAL_SURFACE_PATTERN.test(rawHtml)
    && /Need math help\?\s*Meet Photomath\./i.test(text)
    && extractCareersHandoffUrl(rawHtml) === CAREERS_URL
}

export const isVerifiedGoogleCareersHandoff = (page = {}, requestedUrl = CAREERS_URL) => {
  const rawHtml = String(page?.html ?? '')
  const text = normalizeText(rawHtml)
  const finalUrl = resolvePageUrl(page, requestedUrl)

  return Number(page?.status) === 200
    && finalUrl.startsWith(GOOGLE_CAREERS_URL)
    && GOOGLE_CAREERS_TITLE_PATTERN.test(rawHtml)
    && GOOGLE_CAREERS_SIGNAL_PATTERNS.every((pattern) => pattern.test(text))
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

export const createPhotomathIndiaScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (!hasVerifiedCompanySurface(homepage.html)) {
      throw new Error(
        'Photomath India verified official homepage no longer matches the trusted live brand surface',
      )
    }

    const careersRedirect = await fetchPage(CAREERS_URL)
    if (!isVerifiedGoogleCareersHandoff(careersRedirect, CAREERS_URL)) {
      throw new Error(
        'Photomath India careers redirect no longer matches the verified Google Careers handoff',
      )
    }

    return []
  },
})

export const run = async (options = {}) => createPhotomathIndiaScraper().run(options)
