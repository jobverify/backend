import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'elmach'
export const COMPANY = 'ELMACH Packages India Pvt. Ltd.'
export const HOMEPAGE_URL = 'https://elmach.com/'
export const ROBOTS_URL = 'https://elmach.com/robots.txt'
export const SITEMAP_URL = 'https://elmach.com/sitemap.xml'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://elmach.com/careers',
  'https://elmach.com/careers/',
  'https://elmach.com/career',
  'https://elmach.com/career/',
  'https://elmach.com/jobs',
  'https://elmach.com/jobs/',
  'https://elmach.com/careers.php',
  'https://elmach.com/career.php',
  'https://elmach.com/jobs.php',
]
export const VERIFIED_MISSING_ROUTE_URLS = [
  ROBOTS_URL,
  SITEMAP_URL,
  ...NO_PUBLIC_CAREERS_ROUTE_URLS,
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const FIRST_PARTY_CAREER_LINK_PATTERN =
  /href=["'](?:https?:\/\/(?:www\.)?elmach\.com)?\/(?:careers?|jobs?)(?:\.php)?(?:[/?#][^"']*)?["']/i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcareers?\b/i,
  /\bjobs?\b/i,
  /\bwe(?:'|&#8217;|&#x2019;|&rsquo;)?re hiring\b/i,
  /\bjoin our team\b/i,
  /\bopen positions?\b/i,
  /\bcurrent openings?\b/i,
  /\bjob openings?\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /\bapply now\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /workdayjobs/i,
  /myworkdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /breezy\.hr/i,
  /wellfound\.com/i,
  /linkedin\.com\/jobs/i,
]

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x2019;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
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
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  return /<title>\s*ELMACH Packages India pvt\. ltd\.\s*<\/title>/i.test(rawHtml)
    && normalized.includes('welcome to elmach packages india pvt. ltd.')
    && normalized.includes('about elmach')
    && normalized.includes('products')
    && normalized.includes('news & events')
    && normalized.includes('service support')
    && normalized.includes('request a catalog')
    && normalized.includes('contact us')
    && normalized.includes('manufacturers of blister packing')
    && normalized.includes('custom packaging automation')
    && normalized.includes('4800 blister pack machines installed in over 106 countries worldwide')
    && normalized.includes('sales & service:')
}

export const hasFirstPartyCareerLikeLink = (html) =>
  FIRST_PARTY_CAREER_LINK_PATTERN.test(String(html ?? ''))

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedMissingRoute = (page = {}) => {
  const normalized = normalizeWhitespace(page?.html).toLowerCase()
  const raw = String(page?.html ?? '').trim().toLowerCase()

  return Number(page?.status) === 404
    && !hasFirstPartyCareerLikeLink(page?.html)
    && !hasPublicJobsSignal(page?.html)
    && (
      (
        normalized.includes('404 not found')
        && normalized.includes('the requested url was not found on this server.')
      )
      || raw === 'file not found.'
      || normalized === 'file not found.'
    )
}

export const createElmachScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Elmach verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Elmach homepage now appears to expose a public jobs surface')
    }

    if (hasFirstPartyCareerLikeLink(homepage.html)) {
      throw new Error('Elmach homepage now exposes a first-party careers path')
    }

    for (const routeUrl of VERIFIED_MISSING_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (!isVerifiedMissingRoute(routePage)) {
        if (routeUrl === ROBOTS_URL || routeUrl === SITEMAP_URL) {
          throw new Error(
            `Elmach verified missing robots.txt or sitemap surface changed: ${routePage.url || routeUrl}`,
          )
        }

        throw new Error(`Elmach verified no-public-careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createElmachScraper().run(options)

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
