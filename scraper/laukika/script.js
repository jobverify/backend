import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'laukika'
export const COMPANY = 'Laukika Consultancy Solutions Private Limited'
export const HOMEPAGE_URL = 'https://www.laukika.com/'
export const CAREERS_URL = 'https://www.laukika.com/know-our-brand/'
export const VERIFIED_ON = '2026-08-07'
export const VERIFIED_SURFACE_SUMMARY = 'Verified on Friday, August 7, 2026 that https://www.laukika.com/ remained Laukika Consultancy Solutions Private Limited\'s first-party homepage, that https://www.laukika.com/know-our-brand/ remained its same-domain brand and hiring page with a resume handoff but no public job listings, and that the verified surface still exposed no trustworthy public jobs feed.'
export const CAREERS_ROUTE_URLS = [
  'https://www.laukika.com/careers',
  'https://www.laukika.com/career',
  'https://www.laukika.com/jobs',
  'https://www.laukika.com/job',
  'https://www.laukika.com/join-us',
  'https://www.laukika.com/work-with-us',
  'https://www.laukika.com/openings',
  'https://www.laukika.com/vacancies',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_META_SIGNALS = [
  /<meta name="description" content="Laukika is a top digital marketing agency in Bangalore offering SEO, AI-SEO, GEO, PPC &amp; branding\. Trusted digital marketing services\. Get a free audit today\."\/?>/i,
  /<meta property="og:site_name" content="Laukika Consultancy Solutions"\s*\/?>/i,
]

const HOMEPAGE_BODY_SIGNAL_PATTERNS = [
  /(?:BEST DIGITAL MARKETING AGENCY IN BANGALORE & MYSURU|TURN STORIES TO MEASURABLE SUCCESS)/i,
  /\bDIGITAL MARKETING AGENCY IN BANGALORE\b/i,
  /Laukika Consultancy Solutions has been a valuable partner in supporting our digital growth journey\./i,
  /\bKnow Our Brand\b/i,
]

const CAREERS_PAGE_SIGNALS = [
  'Laukika: Creative Marketing Solutions for Business Success',
  'Know Our Brand',
  'Life, Laughter, Locations, Laukika',
  'Think Different? So Do We.',
  "We're hiring. Giving endless possibilities to your talent.",
  'Send us your resume',
]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bjob description\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /\bview jobs\b/i,
  /\bapply now\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /greenhouse\.io/i,
]

const SUSPICIOUS_HOST_PATTERN =
  /(greenhouse|job-boards\.greenhouse|lever|workday|myworkdayjobs|smartrecruiters|ashby|workable|darwinbox|icims|successfactors|taleo|jobvite|recruitcrm|teamtailor|oraclecloud|dayforce|jobs\.)/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#8217;|&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const canonicalizeUrl = (value) => {
  try {
    return new URL(value).toString()
  } catch {
    return ''
  }
}

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    headers: {
      location: response.headers.get('location'),
    },
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return HOMEPAGE_META_SIGNALS.every((pattern) => pattern.test(rawHtml))
    && HOMEPAGE_BODY_SIGNAL_PATTERNS.every((pattern) => pattern.test(normalized))
    && /<title>\s*Best Digital Marketing Agency in Bangalore \| Laukika\s*<\/title>/i.test(rawHtml)
    && /<meta property="og:url" content="https:\/\/www\.laukika\.com\/"\s*\/?>/i.test(rawHtml)
}

export const hasOfficialCareersSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return CAREERS_PAGE_SIGNALS.every((signal) => normalized.includes(signal))
    && /<title>\s*Laukika: Creative Marketing Solutions for Business Success\s*<\/title>/i.test(rawHtml)
    && /Laukika-video\.mp4/i.test(rawHtml)
    && /data-name="your-file"/i.test(rawHtml)
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const extractSuspiciousPublicJobLinks = (html, baseUrl = CAREERS_URL) => {
  const suspiciousLinks = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1], baseUrl)
    if (!absoluteUrl || seen.has(absoluteUrl)) continue

    const url = new URL(absoluteUrl)
    const pathname = url.pathname.replace(/\/+$/, '') || '/'
    const isKnownPage =
      absoluteUrl === HOMEPAGE_URL
      || absoluteUrl === CAREERS_URL
      || `${absoluteUrl}/` === HOMEPAGE_URL
      || `${absoluteUrl}/` === CAREERS_URL
    const exposesFirstPartyJobPath =
      (url.hostname === 'www.laukika.com' || url.hostname === 'laukika.com')
      && /\/(careers?|jobs?|job-openings?|openings?|vacanc(?:y|ies)|join-us|work-with-us)(\/|$)/i.test(pathname)
      && !isKnownPage

    if (SUSPICIOUS_HOST_PATTERN.test(url.hostname) || exposesFirstPartyJobPath) {
      seen.add(absoluteUrl)
      suspiciousLinks.push(absoluteUrl)
    }
  }

  return suspiciousLinks
}

const assertStablePage = ({
  page,
  hasOfficialSignal,
  label,
  baseUrl,
}) => {
  if (page.status !== 200 || !hasOfficialSignal(page.html)) {
    throw new Error(`Laukika verified official ${label} no longer matches the known public surface`)
  }

  if (hasPublicJobsSignal(page.html)) {
    throw new Error(`Laukika ${label} now appears to expose a public jobs surface`)
  }

  if (extractSuspiciousPublicJobLinks(page.html, baseUrl).length > 0) {
    throw new Error(`Laukika ${label} now exposes public job links`)
  }
}

export const isVerifiedHomepageRedirectRoute = (page = {}, routeUrl) => {
  const requestedUrl = canonicalizeUrl(routeUrl)
  const finalUrl = canonicalizeUrl(page?.url)
  const isVerifiedFirstParty404 = Number(page?.status) === 404
    && finalUrl === requestedUrl
    && /<title>\s*Page Not Found\s*-\s*Laukika\s*<\/title>/i.test(String(page?.html ?? ''))

  return isVerifiedFirstParty404 || (Number(page?.status) === 200
    && finalUrl === HOMEPAGE_URL
    && finalUrl !== requestedUrl
    && hasOfficialHomepageSignal(page?.html)
    && !hasPublicJobsSignal(page?.html)
    && extractSuspiciousPublicJobLinks(page?.html, HOMEPAGE_URL).length === 0)
}

export const createLaukikaScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    assertStablePage({
      page: homepage,
      hasOfficialSignal: hasOfficialHomepageSignal,
      label: 'homepage',
      baseUrl: HOMEPAGE_URL,
    })

    const careersPage = await fetchPage(CAREERS_URL)
    assertStablePage({
      page: careersPage,
      hasOfficialSignal: hasOfficialCareersSignal,
      label: 'brand hiring page',
      baseUrl: CAREERS_URL,
    })

    for (const careersRouteUrl of CAREERS_ROUTE_URLS) {
      const careersRoute = await fetchPage(careersRouteUrl)

      if (!isVerifiedHomepageRedirectRoute(careersRoute, careersRouteUrl)) {
        throw new Error('Laukika careers routes changed materially or now expose public jobs')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createLaukikaScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
