import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'urcconstruction'
export const COMPANY = 'URC Construction'
export const HOMEPAGE_URL = 'https://www.urcindia.com/Default.aspx'
export const CAREERS_URL = 'https://www.urcindia.com/Career.aspx'
export const NON_LISTING_ROUTE_URLS = [
  'https://www.urcindia.com/Employment.aspx',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bjob vacancies\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
  /\bbrowse jobs\b/i,
  /\bjob description\b/i,
  /\bjob title\b/i,
  /\bapply now\b/i,
  /"@type"\s*:\s*"JobPosting"/i,
]

const OFFICIAL_ATS_SIGNAL_PATTERNS = [
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /zohorecruit/i,
  /oraclecloud\.com/i,
  /recruitingbypaycor\.com/i,
]

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

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialAtsSignal = (html) =>
  OFFICIAL_ATS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html) => {
  const raw = normalizeHtml(html)
  const text = normalizeWhitespace(html)

  return /<title>\s*urc construction\s*<\/title>/i.test(String(html ?? ''))
    && /href="career\.aspx">careers<\/a>/i.test(raw)
    && /href="contact-us\.aspx">contact(?: us)?<\/a>/i.test(raw)
    && text.includes('URC Construction brings a wide range of capabilities to major infrastructure projects.')
    && text.includes('past 6 decades')
    && text.includes('About URC')
}

export const hasOfficialCareersSignal = (html) => {
  const raw = normalizeHtml(html)
  const text = normalizeWhitespace(html)

  return /<title>\s*urc construction\s*<\/title>/i.test(String(html ?? ''))
    && raw.includes('action="./career.aspx"')
    && raw.includes('enter 10 digit valid mobileno.')
    && raw.includes('years of work experience')
    && raw.includes('select department')
    && text.includes('Work With Us')
    && text.includes('We place a high value on internal growth and employee learning and development.')
    && text.includes('Department')
    && text.includes('Finance & Accounts Department')
    && text.includes('Please upload your resume as a .pdf, .doc, or .docx file only')
}

export const isVerifiedMissingNonListingRoute = (page = {}) =>
  Number(page?.status) === 404
  && !hasPublicJobsSignal(page?.html)
  && !hasOfficialAtsSignal(page?.html)

export const createUrcConstructionScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('URC Construction verified official homepage no longer matches the known first-party surface')
    }
    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('URC Construction homepage now exposes public jobs')
    }
    if (hasOfficialAtsSignal(homepage.html)) {
      throw new Error('URC Construction homepage now exposes an official ATS')
    }

    const careers = await fetchPage(CAREERS_URL)
    if (careers.status !== 200 || !hasOfficialCareersSignal(careers.html)) {
      throw new Error('URC Construction verified first-party careers page no longer matches the known no-listings surface')
    }
    if (hasPublicJobsSignal(careers.html)) {
      throw new Error('URC Construction verified no-listings surface drifted to public jobs')
    }
    if (hasOfficialAtsSignal(careers.html)) {
      throw new Error('URC Construction verified no-listings surface drifted to an official ATS')
    }

    for (const routeUrl of NON_LISTING_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingNonListingRoute(routePage)) {
        throw new Error(
          'URC Construction non-listing routes changed materially or now expose a public careers surface',
        )
      }
    }

    return []
  },
})

export const run = async (options = {}) => createUrcConstructionScraper().run(options)

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
