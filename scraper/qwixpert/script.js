import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'qwixpert'
export const COMPANY = 'Qwixpert'
export const HOMEPAGE_URL = 'https://qwixpert.com/'
export const SITEMAP_URL = 'https://qwixpert.com/sitemap.xml'
export const SITEMAP_INDEX_URL = 'https://qwixpert.com/wp-sitemap.xml'
export const PAGE_SITEMAP_URL = 'https://qwixpert.com/wp-sitemap-posts-page-1.xml'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://qwixpert.com/careers',
  'https://qwixpert.com/career',
  'https://qwixpert.com/jobs',
  'https://qwixpert.com/job-openings',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREER_PATH_PATTERN =
  /(?:^|\/)(careers?|jobs?|job-openings|openings|join-us|joinus|work-with-us)(?:\/|$)/i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bopen roles\b/i,
  /\bjob openings\b/i,
  /\bjob description\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
  /\bapply now\b/i,
  /\bupload your resume\b/i,
  /\bsubmit (?:your )?resume\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /breezy\.hr/i,
  /wellfound\.com/i,
  /workable\.com/i,
]

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#038;|&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const extractLocUrls = (xml) =>
  Array.from(String(xml ?? '').matchAll(/<loc>([^<]+)<\/loc>/gi), (match) => match[1].trim())

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, HOMEPAGE_URL)
  } catch {
    return null
  }
}

const isFirstPartyUrl = (url) => {
  const hostname = String(url?.hostname ?? '').toLowerCase()
  return hostname === 'qwixpert.com' || hostname === 'www.qwixpert.com' || hostname.endsWith('.qwixpert.com')
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasUnexpectedCareerLikeLink = (html) => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1])
    if (!absoluteUrl || !isFirstPartyUrl(absoluteUrl)) {
      continue
    }

    if (CAREER_PATH_PATTERN.test(absoluteUrl.pathname)) {
      return true
    }
  }

  return false
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Qwixpert Consulting\s*(?:&#8211;|&ndash;|-)\s*Operational Excellence\s*<\/title>/i.test(rawHtml)
    && /<meta[^>]+name=["']application-name["'][^>]+content=["']Qwixpert Consulting["']/i.test(rawHtml)
    && rawHtml.includes('https://qwixpert.com/about-qwixpert/')
    && rawHtml.includes('https://qwixpert.com/contact-us/')
    && normalized.includes('We fix what slows you down')
    && normalized.includes('Your partner in unlocking Operational Excellence')
    && normalized.includes('Not sure where to start?')
    && normalized.includes("Let's discuss your current bottlenecks and design a solution roadmap.")
    && normalized.includes('Connect with us')
}

export const isVerifiedSitemapIndex = (page = {}) => {
  const urls = extractLocUrls(page?.html)

  return Number(page?.status) === 200
    && page?.url === SITEMAP_INDEX_URL
    && urls.length >= 5
    && urls.includes(PAGE_SITEMAP_URL)
    && urls.includes('https://qwixpert.com/wp-sitemap-posts-post-1.xml')
    && urls.includes('https://qwixpert.com/wp-sitemap-users-1.xml')
    && urls.every((url) => {
      const absoluteUrl = toAbsoluteUrl(url)
      return absoluteUrl && isFirstPartyUrl(absoluteUrl) && !CAREER_PATH_PATTERN.test(absoluteUrl.pathname)
    })
}

export const isVerifiedPageSitemap = (page = {}) => {
  const urls = extractLocUrls(page?.html)

  return Number(page?.status) === 200
    && page?.url === PAGE_SITEMAP_URL
    && urls.length >= 10
    && urls.includes(HOMEPAGE_URL)
    && urls.includes('https://qwixpert.com/about-qwixpert/')
    && urls.includes('https://qwixpert.com/contact-us/')
    && urls.includes('https://qwixpert.com/services/')
    && urls.includes('https://qwixpert.com/technology/')
    && urls.every((url) => {
      const absoluteUrl = toAbsoluteUrl(url)
      return absoluteUrl && isFirstPartyUrl(absoluteUrl) && !CAREER_PATH_PATTERN.test(absoluteUrl.pathname)
    })
}

export const isVerifiedMissingCareerRoute = (page = {}) => {
  const rawHtml = String(page?.html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return Number(page?.status) === 404
    && /<title>\s*Page not found\s*(?:&#8211;|&ndash;|-)\s*Qwixpert Consulting\s*<\/title>/i.test(rawHtml)
    && normalized.includes('Hey there mate!')
    && normalized.includes('Your lost treasure is not found here...')
    && normalized.includes("Sorry! The page you are looking for wasn't found!")
    && normalized.includes('Qwixpert Consulting')
    && !hasUnexpectedCareerLikeLink(rawHtml)
    && !hasPublicJobsSignal(rawHtml)
}

export const createQwixpertScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || homepage.url !== HOMEPAGE_URL || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Qwixpert verified official homepage no longer matches the known first-party surface')
    }
    if (hasUnexpectedCareerLikeLink(homepage.html)) {
      throw new Error('Qwixpert homepage now exposes a first-party careers path')
    }
    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Qwixpert homepage now appears to expose a public jobs surface')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (!isVerifiedSitemapIndex(sitemap)) {
      throw new Error('Qwixpert verified sitemap index no longer matches the no-public-careers surface')
    }

    const pageSitemap = await fetchPage(PAGE_SITEMAP_URL)
    if (!isVerifiedPageSitemap(pageSitemap)) {
      throw new Error('Qwixpert verified page sitemap no longer matches the no-public-careers surface')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingCareerRoute(routePage)) {
        throw new Error(
          `Qwixpert careers routes changed materially or now expose a public careers surface: ${routePage.url || routeUrl}`,
        )
      }
    }

    return []
  },
})

export const run = async (options = {}) => createQwixpertScraper().run(options)

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
