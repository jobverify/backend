import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'rsacademy'
export const COMPANY = 'RS Academy'
export const HOMEPAGE_URL = 'https://www.rsacademy.co.in/'
export const NON_LISTING_ROUTE_URLS = [
  'https://www.rsacademy.co.in/careers',
  'https://www.rsacademy.co.in/careers/',
  'https://www.rsacademy.co.in/career',
  'https://www.rsacademy.co.in/jobs',
  'https://www.rsacademy.co.in/join-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREER_PATH_PATTERN = /(?:^|\/)(career|careers|job|jobs|opening|openings|vacancy|vacancies|hiring|join-us|joinus|work-with-us)(?:\/|$)/i
const ATS_HOST_PATTERN = /(^|\.)(ashbyhq\.com|greenhouse\.io|lever\.co|myworkdayjobs\.com|smartrecruiters\.com|freshteam\.com|workable\.com|darwinbox\.in|keka\.com|zohorecruit\.com)$/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase()

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, HOMEPAGE_URL)
  } catch {
    return null
  }
}

const isPublicJobsUrl = (url) => {
  if (!url || !/^https?:$/i.test(url.protocol)) return false
  return CAREER_PATH_PATTERN.test(url.pathname) || ATS_HOST_PATTERN.test(url.hostname)
}

const normalizeComparablePath = (pathname) => {
  const normalizedPath = String(pathname || '/').replace(/\/+$/g, '')
  return normalizedPath || '/'
}

const isSamePageUrl = (candidateUrl, pageUrl) => {
  const absolutePageUrl = toAbsoluteUrl(pageUrl)
  if (!candidateUrl || !absolutePageUrl) return false
  return candidateUrl.origin === absolutePageUrl.origin
    && normalizeComparablePath(candidateUrl.pathname) === normalizeComparablePath(absolutePageUrl.pathname)
    && candidateUrl.search === absolutePageUrl.search
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
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title[^>]*>\s*Rupanjalis Salon - Family Salon Salt Lake\s*<\/title>/i.test(rawHtml)
    && /<meta[^>]+name=["']description["'][^>]+content=["']We are the best Family Salon you were searching in Kolkata, Salt Lake area\.\s*We only work with professionals in our saloon\.\s*Appointment now 8910237886["']/i.test(rawHtml)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.rsacademy\.co\.in\/["']/i.test(rawHtml)
    && normalized.includes('info@rsacademy.co.in')
    && normalized.includes('8910237886')
    && normalized.includes('bride show stopper makeup')
    && normalized.includes('learn professionals makeup')
    && normalized.includes('salt lake')
    && normalized.includes('rupanjali')
}

export const hasPublicJobsSignal = (html, pageUrl = HOMEPAGE_URL) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  if (/"@type"\s*:\s*"JobPosting"/i.test(rawHtml)) {
    return true
  }

  if (/\b(current openings|job openings|open roles|we are hiring|apply now|join our team)\b/i.test(normalized)) {
    return true
  }

  for (const match of rawHtml.matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1])
    if (isSamePageUrl(absoluteUrl, pageUrl)) {
      continue
    }

    if (isPublicJobsUrl(absoluteUrl)) {
      return true
    }
  }

  return false
}

export const hasSoft404NonListingSignal = (html, pageUrl) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title[^>]*>\s*Page not found\s*<\/title>/i.test(rawHtml)
    && normalized.includes('page not found')
    && !hasPublicJobsSignal(rawHtml, pageUrl)
}

export const isVerifiedForbiddenHomepage = (page = {}) => {
  const rawHtml = String(page?.html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return Number(page?.status) === 403
    && /<title[^>]*>\s*403 Forbidden\s*<\/title>/i.test(rawHtml)
    && normalized.includes('403 forbidden')
    && normalized.includes("you don't have permission to access this resource")
}

export const isVerifiedMissingRouteShell = (page = {}) => {
  const rawHtml = String(page?.html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return Number(page?.status) === 404
    && /<title[^>]*>\s*404 Not Found\s*<\/title>/i.test(rawHtml)
    && normalized.includes('404 not found')
    && normalized.includes('the requested url was not found on this server')
    && !hasPublicJobsSignal(rawHtml, page?.url || HOMEPAGE_URL)
}

export const createRsAcademyScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (isVerifiedForbiddenHomepage(homepage)) {
      for (const routeUrl of NON_LISTING_ROUTE_URLS) {
        const routePage = await fetchPage(routeUrl)
        if (!isVerifiedMissingRouteShell(routePage)) {
          throw new Error(`RS Academy verified missing-route shell changed: ${routePage.url || routeUrl}`)
        }
      }

      return []
    }

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('RS Academy verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html, homepage.url || HOMEPAGE_URL)) {
      throw new Error('RS Academy homepage now exposes a public careers or jobs signal')
    }

    for (const routeUrl of NON_LISTING_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (routePage.status !== 200 || !hasSoft404NonListingSignal(routePage.html, routePage.url || routeUrl)) {
        throw new Error(`RS Academy verified non-listing route changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createRsAcademyScraper().run(options)

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
