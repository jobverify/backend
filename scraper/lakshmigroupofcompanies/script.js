import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'lakshmigroupofcompanies'
export const COMPANY = 'Lakshmi Group of Companies'
export const HOMEPAGE_URL = 'http://www.lakshmigroup.co.in/'
export const CAREERS_ROUTE_URLS = [
  'http://www.lakshmigroup.co.in/careers',
  'http://www.lakshmigroup.co.in/career',
  'http://www.lakshmigroup.co.in/jobs',
  'http://www.lakshmigroup.co.in/join-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREER_LIKE_LINK_PATTERN = /href=["']https?:\/\/(?:www\.)?lakshmigroup\.co\.in\/(?:careers?|jobs?|join-us|work-with-us|openings?|vacanc(?:y|ies))(?:[\/#?][^"']*)?["']|href=["']\/(?:careers?|jobs?|join-us|work-with-us|openings?|vacanc(?:y|ies))(?:[\/#?][^"']*)?["']/i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bjoin our team\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /zohorecruit/i,
]

const MISSING_ROUTE_PATTERNS = [
  /<title>\s*404 Not Found\s*<\/title>/i,
  /<h1>\s*Not Found\s*<\/h1>/i,
  /The requested URL was not found on this server\./i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

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

  return /<title>\s*Lakshmi Group\s*<\/title>/i.test(rawHtml)
    && /\bLakshmi Group\b/i.test(normalized)
    && /Lakshmi Group is one of the leading names in Automobile Dealership across South India\./i.test(normalized)
    && /Lakshmi Group as on date operates through 60\+\s*state of art Workshops,\s*50 Showrooms,\s*8 Used Car Showrooms,\s*16 Commercial Showrooms and 1 Driving School/i.test(normalized)
    && /34 years of Automobile Journey\./i.test(normalized)
    && /Team of 4,545 employees/i.test(normalized)
    && /Powered By CarDekho Pvt\. Ltd\./i.test(normalized)
}

export const hasFirstPartyCareerLikeLink = (html) =>
  CAREER_LIKE_LINK_PATTERN.test(String(html ?? ''))

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedMissingCareersRoute = (page = {}) => {
  if (Number(page?.status) !== 404) {
    return false
  }

  if (hasPublicJobsSignal(page?.html)) {
    return false
  }

  return MISSING_ROUTE_PATTERNS.every((pattern) => pattern.test(String(page?.html ?? '')))
}

export const createLakshmiGroupOfCompaniesScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Lakshmi Group of Companies verified official homepage no longer matches the known public surface')
    }

    if (hasFirstPartyCareerLikeLink(homepage.html)) {
      throw new Error('Lakshmi Group of Companies homepage now exposes a first-party careers or jobs link')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Lakshmi Group of Companies homepage now exposes a public jobs surface')
    }

    for (const careersRouteUrl of CAREERS_ROUTE_URLS) {
      const careersRoute = await fetchPage(careersRouteUrl)

      if (!isVerifiedMissingCareersRoute(careersRoute)) {
        throw new Error('Lakshmi Group of Companies careers routes changed materially or now expose public jobs')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createLakshmiGroupOfCompaniesScraper().run(options)

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
