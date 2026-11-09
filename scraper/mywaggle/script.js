import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'mywaggle'
export const COMPANY = 'Mywaggle'
export const HOMEPAGE_URL = 'https://mywaggle.com/'
export const CAREERS_PAGE_URL = 'https://mywaggle.com/pages/careers'
export const JOBS_PAGE_URL = 'https://mywaggle.com/pages/jobs'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const ATS_LINK_PATTERN =
  /href=["'][^"']*(?:\/pages\/careers|\/pages\/jobs|greenhouse\.io|lever\.co|workdayjobs|ashbyhq\.com|smartrecruiters\.com|recruitee\.com|bamboohr\.com|teamtailor\.com|jobvite\.com)[^"']*["']/i

const RECRUITING_TEXT_PATTERN =
  /\b(careers?|jobs?|job openings?|open roles?|open positions?|current openings?|we are hiring|join our team)\b/i

const stripHtml = (html) =>
  String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&ndash;|&#8211;/gi, '-')
    .replace(/&#8217;|&rsquo;|&#x27;/gi, "'")
    .replace(/[’]/g, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const hasRecruitingSignal = (html) => {
  const page = String(html ?? '')
  return ATS_LINK_PATTERN.test(page) || RECRUITING_TEXT_PATTERN.test(stripHtml(page))
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = stripHtml(page)

  return /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/mywaggle\.com\/["']/i.test(page)
    && /<title>\s*Waggle\s*\|\s*#1 RV\s*(?:&|&amp;)\s*Pet Monitoring Devices\s*\|\s*Waggle(?:Â®|®)?\s*<\/title>/i.test(page)
    && normalized.includes('Built for Pets, Trusted by Pet Parents!')
    && normalized.includes('855-983-5566')
    && normalized.includes('support@mywaggle.com')
}

export const isVerifiedMissingJobsRoute = (pageOrHtml) => {
  const page = typeof pageOrHtml === 'string'
    ? { status: 404, html: pageOrHtml }
    : (pageOrHtml || {})
  const html = String(page.html ?? '')
  const normalized = stripHtml(html)

  return Number(page.status) === 404
    && /<body[^>]+class=["'][^"']*template-404[^"']*["']/i.test(html)
    && /\berror-404\b/i.test(html)
    && /<title>\s*404 Not Found\s*(?:-|&ndash;)\s*Waggle\s*<\/title>/i.test(html)
    && normalized.includes('404')
    && normalized.includes("Sorry! Page you are looking can't be found.")
    && normalized.includes('Go back to the homepage')
    && normalized.includes('855-983-5566')
    && normalized.includes('support@mywaggle.com')
    && !hasRecruitingSignal(html)
}

export const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })

  if (!response.ok && response.status !== 404) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const createMywaggleScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      homepage.status !== 200
      || !hasOfficialHomepageSignal(homepage.html)
      || hasRecruitingSignal(homepage.html)
    ) {
      throw new Error('Mywaggle homepage no longer matches the verified no-public-jobs surface')
    }

    const careersPage = await fetchPage(CAREERS_PAGE_URL)
    if (!isVerifiedMissingJobsRoute(careersPage)) {
      throw new Error('Mywaggle checked careers route no longer matches the verified 404 surface')
    }

    const jobsPage = await fetchPage(JOBS_PAGE_URL)
    if (!isVerifiedMissingJobsRoute(jobsPage)) {
      throw new Error('Mywaggle checked jobs route no longer matches the verified 404 surface')
    }

    return []
  },
})

export const run = async (options = {}) => createMywaggleScraper().run(options)

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
