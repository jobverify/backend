import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'pivotrics'
export const COMPANY = 'Pivotrics'
export const HOMEPAGE_URL = 'https://www.pivotrics.com/'
export const ROBOTS_URL = 'https://www.pivotrics.com/robots.txt'
export const SITEMAP_URL = 'https://www.pivotrics.com/sitemap.xml'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://www.pivotrics.com/careers',
  'https://www.pivotrics.com/careers/',
  'https://www.pivotrics.com/career',
  'https://www.pivotrics.com/career/',
  'https://www.pivotrics.com/jobs',
  'https://www.pivotrics.com/jobs/',
  'https://www.pivotrics.com/join-us',
  'https://www.pivotrics.com/join-us/',
  'https://www.pivotrics.com/openings',
  'https://www.pivotrics.com/openings/',
  'https://www.pivotrics.com/hiring',
  'https://www.pivotrics.com/hiring/',
  'https://www.pivotrics.com/work-with-us',
  'https://www.pivotrics.com/work-with-us/',
]
export const VERIFIED_MISSING_ROUTE_URLS = [
  ROBOTS_URL,
  SITEMAP_URL,
  ...NO_PUBLIC_CAREERS_ROUTE_URLS,
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcareers?\b/i,
  /\bjobs?\b/i,
  /\bwe(?:'|&#8217;|&#x2019;|&rsquo;)?re hiring\b/i,
  /\bjoin our team\b/i,
  /\bopen positions?\b/i,
  /\bcurrent openings?\b/i,
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
  /indeed\.com/i,
  /naukri\.com/i,
  /linkedin\.com\/jobs/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\u2012|\u2013|\u2014|\u2212/g, '-')
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

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  return rawHtml.includes('<title>Welcome to Pivotrics | Software Product Engineering</title>')
    && /<meta[^>]+name=["']description["'][^>]+content=["']We build and run elite AI-native product engineering teams for payments and high-volume B2B SaaS/i.test(rawHtml)
    && normalized.includes('offshore product teams - yours to own')
    && normalized.includes('book a 2-week blueprint')
    && normalized.includes('the pivot system')
    && normalized.includes('prefer email? info@pivotrics.com')
    && normalized.includes('pivotrics.com')
    && normalized.includes('pivotmodel.org')
    && normalized.includes('bengaluru, india')
    && normalized.includes('lawrenceville, ga, usa')
    && normalized.includes('pivotrics technologies llp')
    && /mailto:info@pivotrics\.com/i.test(rawHtml)
    && /https:\/\/pivotmodel\.org/i.test(rawHtml)
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedMissingRoute = (page) => {
  const normalized = normalizeWhitespace(page?.html).toLowerCase()

  return Number(page?.status) === 404
    && normalized.includes('404 not found')
    && normalized.includes('the requested url was not found on this server.')
}

export const createPivotricsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Pivotrics verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Pivotrics homepage now appears to expose a public jobs surface')
    }

    for (const routeUrl of VERIFIED_MISSING_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (!isVerifiedMissingRoute(routePage)) {
        if (routeUrl === ROBOTS_URL || routeUrl === SITEMAP_URL) {
          throw new Error(
            `Pivotrics verified missing robots.txt or sitemap surface changed: ${routePage.url || routeUrl}`,
          )
        }

        throw new Error(`Pivotrics verified no-public-careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createPivotricsScraper().run(options)

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
