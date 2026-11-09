import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'onepaperresearchanalystpvtltd'
export const COMPANY = 'OnePaper Research Analysts Pvt Ltd'
export const HOMEPAGE_URL = 'https://www.onepaper.in/'
export const ABOUT_URL = 'https://www.onepaper.in/about'
export const CAREERS_ROUTE_URLS = [
  'https://www.onepaper.in/careers',
  'https://www.onepaper.in/careers/',
  'https://www.onepaper.in/career',
  'https://www.onepaper.in/career/',
  'https://www.onepaper.in/jobs',
  'https://www.onepaper.in/jobs/',
  'https://www.onepaper.in/work-with-us',
  'https://www.onepaper.in/work-with-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const FIRST_PARTY_CAREER_LINK_PATTERN =
  /href=["'](?:https?:\/\/(?:www\.)?onepaper\.in)?\/(?:careers?|jobs?|work-with-us)(?:[\/#?][^"']*)?["']/i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bopen roles\b/i,
  /\bjob openings\b/i,
  /\bjob description\b/i,
  /\bsearch jobs\b/i,
  /\bjoin our team\b/i,
  /\bwork with us\b/i,
  /\bsubmit (?:your )?resume\b/i,
  /\bupload your resume\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /zohorecruit/i,
]

const REDIRECT_STATUS_CODES = new Set([301, 302, 307, 308])

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeHtml = (value) => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'manual',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    location: response.headers.get('location'),
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const raw = normalizeHtml(html)
  const normalized = normalizeWhitespace(html)

  return raw.includes('<title>onepaper</title>')
    && raw.includes('href="/about"')
    && raw.includes('href="/services"')
    && normalized.includes('Your search ends with our research!')
    && normalized.includes('SEBI Research Analysts Registration Number - INH000008093')
    && normalized.includes('Corporate Identification Number - U72900MH2020PTC346236')
    && normalized.includes('OnePaper Research Analysts Pvt Ltd')
    && normalized.includes('support@onepaper.in')
    && normalized.includes('022-49392323')
}

export const hasOfficialAboutSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('About OnePaper')
    && normalized.includes('We specialize in conducting in-depth market research and analysis')
    && normalized.includes('The corporate culture at OnePaper is centered around delivery of results.')
    && normalized.includes('OnePaper Research Analysts Pvt Ltd')
    && normalized.includes('support@onepaper.in')
}

export const hasFirstPartyCareerLikeLink = (html) =>
  FIRST_PARTY_CAREER_LINK_PATTERN.test(String(html ?? ''))

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedMissingCareersRoute = (page = {}) => {
  const raw = normalizeHtml(page?.html)
  const normalized = normalizeWhitespace(page?.html)

  return Number(page?.status) === 404
    && raw.includes('data-wf-domain="www.onepaper.in"')
    && raw.includes('data-wf-site="66e83bf8f453bba4ff5f7276"')
    && normalized.includes('Page Not Found')
    && normalized.includes("The page you are looking for doesn't exist or has been moved")
    && !hasFirstPartyCareerLikeLink(page?.html)
    && !hasPublicJobsSignal(page?.html)
}

export const isVerifiedTrailingSlashRedirect = (page = {}, expectedLocation) =>
  REDIRECT_STATUS_CODES.has(Number(page?.status))
  && String(page?.location ?? '') === String(expectedLocation ?? '')
  && normalizeWhitespace(page?.html).includes('301 Moved Permanently')
  && normalizeWhitespace(page?.html).includes('openresty')
  && !hasFirstPartyCareerLikeLink(page?.html)
  && !hasPublicJobsSignal(page?.html)

export const createOnePaperResearchAnalystsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('OnePaper Research Analysts verified official homepage no longer matches the known public surface')
    }
    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('OnePaper Research Analysts homepage now exposes public jobs')
    }
    if (hasFirstPartyCareerLikeLink(homepage.html)) {
      throw new Error('OnePaper Research Analysts homepage now exposes a first-party careers path')
    }

    const about = await fetchPage(ABOUT_URL)
    if (about.status !== 200 || !hasOfficialAboutSignal(about.html)) {
      throw new Error('OnePaper Research Analysts verified about surface no longer matches the known public surface')
    }
    if (hasPublicJobsSignal(about.html)) {
      throw new Error('OnePaper Research Analysts about surface now exposes public jobs')
    }
    if (hasFirstPartyCareerLikeLink(about.html)) {
      throw new Error('OnePaper Research Analysts about surface now exposes a first-party careers path')
    }

    for (const careersRouteUrl of CAREERS_ROUTE_URLS) {
      const careersRoute = await fetchPage(careersRouteUrl)
      const isVerifiedRoute = isVerifiedMissingCareersRoute(careersRoute)
        || isVerifiedTrailingSlashRedirect(
          careersRoute,
          careersRouteUrl.replace(/\/$/, ''),
        )

      if (!isVerifiedRoute) {
        throw new Error(
          'OnePaper Research Analysts careers routes changed materially or now expose a public careers surface',
        )
      }
    }

    return []
  },
})

export const run = async (options = {}) => createOnePaperResearchAnalystsScraper().run(options)

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
