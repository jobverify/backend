import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'tectigers'
export const COMPANY = 'TecTigers'
export const HOMEPAGE_URL = 'https://www.tectigers.com/'
export const CAREERS_URL = 'https://www.tectigers.com/careers/'
export const CONTACT_URL = 'https://www.tectigers.com/contact-us/'
export const CAREERS_FEED_URL = 'https://www.tectigers.com/careers/feed/'
export const SITEMAP_URL = 'https://www.tectigers.com/sitemap.xml'
export const NO_PUBLIC_JOB_ROUTE_URLS = [
  'https://www.tectigers.com/jobs',
  'https://www.tectigers.com/jobs/',
  'https://www.tectigers.com/join-us',
  'https://www.tectigers.com/join-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bwe(?:'|&#8217;|&#x2019;|&rsquo;)?re hiring\b/i,
  /\bjoin our team\b/i,
  /\bopen positions?\b/i,
  /\bcurrent openings?\b/i,
  /\bjob openings?\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /breezy\.hr/i,
  /freshteam/i,
  /greenhouse/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;|&#038;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html) =>
  String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? ''

const extractCanonical = (html) =>
  String(html ?? '').match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] ?? null

const countArticles = (html) => (String(html ?? '').match(/<article\b/gi) || []).length

const extractFirstPartyCareerDetailLinks = (html) => {
  const matches = [...String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["']/gi)]

  return matches
    .map((match) => match[1])
    .filter((href) =>
      /^https:\/\/www\.tectigers\.com\/careers\/.+/i.test(href)
      && !/\/careers\/?(?:[#?].*)?$/i.test(href)
      && !/\/careers\/feed\/?$/i.test(href),
    )
}

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(value)
    const pathname = url.pathname.replace(/\/+$/g, '') || '/'
    return `${url.origin}${pathname}`.toLowerCase()
  } catch {
    return null
  }
}

const isFirstPartyUrl = (value) => {
  try {
    return new URL(value || HOMEPAGE_URL).hostname.toLowerCase() === 'www.tectigers.com'
  } catch {
    return false
  }
}

const sitemapLocs = (xml) =>
  [...String(xml ?? '').matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => match[1])

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(normalizeWhitespace(html)))
  || /"@type"\s*:\s*"JobPosting"|jobs\.lever\.co|boards\.greenhouse\.io|job-boards\.greenhouse\.io|ashbyhq\.com|myworkdayjobs|workdayjobs|smartrecruiters|jobvite|breezy\.hr|freshteam/i
    .test(String(html ?? ''))

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return extractTitle(page) === 'Managed IT Services Provider | Digital Transformation Solutions'
    && extractCanonical(page) === HOMEPAGE_URL
    && text.includes('Managed IT Services and Cybersecurity Solutions to Secure Your Business')
    && text.includes('Proactive IT Support, Digital Transformation Experts')
    && text.includes('Building AI power Cybersecurity solutions today.')
    && text.includes('Stay Secure and Operational 24/7 with Managed IT Services Provider')
    && text.includes('Think IT, Think TecTigers')
  }

export const hasOfficialCareersArchiveSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return extractTitle(page) === 'Careers Archive - Tectigers | Managed IT Services Provider'
    && extractCanonical(page) === CAREERS_URL
    && /post-type-archive-neuros_vacancy/i.test(page)
    && text.includes('Careers Archive')
  }

export const hasOfficialContactSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return extractTitle(page) === 'Contact TecTigers | Leading Managed IT Services Company'
    && extractCanonical(page) === CONTACT_URL
    && text.includes('Contact Us')
    && text.includes('get in touch We are always ready to help you and answer your questions')
    && (
      (text.includes('Call Us 24/7') && text.includes('Need a consultation?'))
      || (text.includes('Address: 30 N Gould St Ste R Sheridan, WY 82801, USA') && text.includes('info@tectigers.com'))
    )
  }

export const isEmptyCareersFeed = (xml) => {
  const feed = String(xml ?? '')

  return /<title>\s*Careers Archive - Tectigers \| Managed IT Services Provider\s*<\/title>/i.test(feed)
    && /<link>\s*https:\/\/www\.tectigers\.com\/careers\/\s*<\/link>/i.test(feed)
    && !/<item>/i.test(feed)
    && !hasPublicJobsSignal(feed)
  }

export const hasExpectedSitemapEntries = (xml) => {
  const locs = sitemapLocs(xml)
  const normalizedLocs = locs.map((loc) => normalizeComparableUrl(loc))

  return normalizedLocs.includes(normalizeComparableUrl(HOMEPAGE_URL))
    && normalizedLocs.includes(normalizeComparableUrl(CONTACT_URL))
    && !locs.some((loc) => /^https:\/\/www\.tectigers\.com\/careers\/.+/i.test(loc) && normalizeComparableUrl(loc) !== normalizeComparableUrl(CAREERS_URL))
    && !locs.some((loc) => /^https:\/\/www\.tectigers\.com\/jobs(?:\/|$)/i.test(loc))
    && !hasPublicJobsSignal(xml)
  }

export const isVerifiedMissingJobRoute = (page = {}) => {
  const html = String(page?.html ?? '')
  const text = normalizeWhitespace(html)

  return Number(page?.status) === 404
    && extractTitle(html) === 'Page not found - Tectigers | Managed IT Services Provider'
    && text.includes('Navigate to a Smarter Experience')
    && text.includes('Contact Us')
    && !hasPublicJobsSignal(html)
  }

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const createTecTigersScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !isFirstPartyUrl(homepage.url) || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('TecTigers verified official homepage no longer matches the known first-party surface')
    }
    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('TecTigers homepage now appears to expose a public jobs surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !isFirstPartyUrl(careersPage.url) || !hasOfficialCareersArchiveSignal(careersPage.html)) {
      throw new Error('TecTigers verified careers archive no longer matches the known first-party empty surface')
    }
    if (hasPublicJobsSignal(careersPage.html) || countArticles(careersPage.html) > 0 || extractFirstPartyCareerDetailLinks(careersPage.html).length > 0) {
      throw new Error('TecTigers careers archive now appears to expose public jobs')
    }

    const contactPage = await fetchPage(CONTACT_URL)
    if (contactPage.status !== 200 || !isFirstPartyUrl(contactPage.url) || !hasOfficialContactSignal(contactPage.html)) {
      throw new Error('TecTigers verified contact page no longer matches the known first-party surface')
    }
    if (hasPublicJobsSignal(contactPage.html)) {
      throw new Error('TecTigers contact page now appears to expose a public jobs surface')
    }

    const careersFeed = await fetchPage(CAREERS_FEED_URL)
    if (careersFeed.status !== 200 || !isFirstPartyUrl(careersFeed.url) || !isEmptyCareersFeed(careersFeed.html)) {
      throw new Error('TecTigers verified careers feed no longer matches the known empty archive surface')
    }

    const sitemapPage = await fetchPage(SITEMAP_URL)
    if (sitemapPage.status !== 200 || !isFirstPartyUrl(sitemapPage.url) || !hasExpectedSitemapEntries(sitemapPage.html)) {
      throw new Error('TecTigers verified sitemap changed materially or now exposes public jobs routes')
    }

    for (const routeUrl of NO_PUBLIC_JOB_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isFirstPartyUrl(routePage.url || routeUrl) || !isVerifiedMissingJobRoute(routePage)) {
        throw new Error(`TecTigers verified missing job route changed or now exposes a public jobs surface: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createTecTigersScraper().run(options)

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
