import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'yanmar'
export const COMPANY = 'YANMAR'
export const HOMEPAGE_URL = 'https://www.yanmar.com/global/'
export const ABOUT_URL = 'https://www.yanmar.com/global/about/'
export const CAREERS_URL = 'https://www.yanmar.com/global/career/'
export const JOBS_URL = 'https://www.yanmar.com/global/career/jobs/'
export const CONTACT_URL = 'https://www.yanmar.com/global/support/contact/form/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob description\b/i,
  /\bview details\b/i,
  /\bapply now\b/i,
  /\bapply here\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /greenhouse\.io/i,
  /recruitcrm/i,
  /linkedin\.com\/jobs/i,
  /href=["'][^"']*\/career\/jobs\/[^"'/]+/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
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
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('yanmar')
    && normalized.includes('our philosophy')
    && normalized.includes('yanmar green challenge 2050')
    && normalized.includes('search jobs')
    && normalized.includes('copyright')
    && normalized.includes('yanmar holdings co., ltd.')
}

export const hasOfficialAboutSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('about us')
    && normalized.includes('engineering a better society')
    && normalized.includes('a sustainable future')
    && normalized.includes('group companies (worldwide)')
    && normalized.includes('copyright')
    && normalized.includes('yanmar holdings co., ltd.')
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('career')
    && normalized.includes('discover a world of career possibilities at yanmar group')
    && normalized.includes('message from chro')
    && normalized.includes('search jobs')
    && normalized.includes('copyright')
    && normalized.includes('yanmar holdings co., ltd.')
}

export const hasOfficialJobsSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('search jobs')
    && normalized.includes('find your career opportunity')
    && normalized.includes('career')
    && normalized.includes('copyright')
    && normalized.includes('yanmar holdings co., ltd.')
}

export const hasOfficialContactSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('dealer locator')
    && normalized.includes('faq')
    && normalized.includes('contact form')
    && normalized.includes('fields marked required must be filled in')
    && normalized.includes('company company name')
    && normalized.includes('copyright')
    && normalized.includes('yanmar holdings co., ltd.')
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createYanmarScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('YANMAR verified official homepage no longer matches the trusted first-party surface')
    }

    const aboutPage = await fetchPage(ABOUT_URL)
    if (aboutPage.status !== 200 || !hasOfficialAboutSignal(aboutPage.html)) {
      throw new Error('YANMAR verified about page no longer matches the trusted first-party surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('YANMAR verified careers page no longer matches the trusted first-party surface')
    }

    const jobsPage = await fetchPage(JOBS_URL)
    if (jobsPage.status !== 200 || !hasOfficialJobsSignal(jobsPage.html)) {
      throw new Error('YANMAR verified jobs page no longer matches the trusted first-party surface')
    }

    const contactPage = await fetchPage(CONTACT_URL)
    if (contactPage.status !== 200 || !hasOfficialContactSignal(contactPage.html)) {
      throw new Error('YANMAR verified contact page no longer matches the trusted first-party surface')
    }

    if (hasPublicJobsSignal(jobsPage.html)) {
      throw new Error('YANMAR jobs page now appears to expose a direct public jobs surface')
    }

    return []
  },
})

export const run = async (options = {}) => createYanmarScraper().run(options)

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
