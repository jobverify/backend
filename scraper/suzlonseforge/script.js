import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'suzlonseforge'
export const COMPANY = 'Suzlon-SE Forge'
export const HOMEPAGE_URL = 'https://www.suzlon.com/'
export const CAREERS_URL = 'https://www.suzlon.com/careers/'
export const CHECKED_ROUTE_URLS = [
  'https://www.suzlon.com/jobs/',
  'https://www.suzlon.com/career/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
  /\bbrowse jobs\b/i,
  /\bapply now\b/i,
  /\bjob alert\b/i,
  /\brequisition\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /breezy\.hr/i,
  /linkedin\.com\/jobs\/view/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim()

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&apos;|&#39;|&rsquo;|&#8217;/gi, "'")

const extractVisibleText = (html) => normalizeWhitespace(
  decodeHtmlEntities(String(html ?? ''))
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value, baseUrl) => {
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const normalizeUrl = (value) => {
  try {
    const url = new URL(value)
    return url.toString().replace(/\/+$/, '')
  } catch {
    return null
  }
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

export const extractHomepageCareersUrl = (html) =>
  toAbsoluteUrl(
    (String(html ?? '').match(/href=["']([^"']*\/careers\/?)["']/i) || [])[1],
    HOMEPAGE_URL,
  )

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const visibleText = extractVisibleText(page)

  return page.includes('Full Stack Renewable Energy Partner | Suzlon Group')
    && visibleText.includes('Our Offerings')
    && visibleText.includes('Latest news')
    && visibleText.includes('Find your place in our team of thinkers and innovators')
    && visibleText.includes('choosing the energy that moves the world forward every day')
    && /href=["']\/careers\/?["']/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const visibleText = extractVisibleText(page)

  return page.includes("Careers at Suzlon | Join India's Wind Energy Leader")
    && visibleText.includes('Your work can move the world forward')
    && visibleText.includes('We are building renewable energy systems designed for the new world')
    && visibleText.includes('Advancing people. Accelerating futures')
    && visibleText.includes('Equal opportunities')
    && visibleText.includes('Career advancement')
    && visibleText.includes("Women's Development")
    && visibleText.includes('1Learn')
    && visibleText.includes('Sectoral development')
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createSuzlonSeForgeScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Suzlon verified official homepage no longer matches the trusted first-party surface')
    }

    const homepageCareersUrl = extractHomepageCareersUrl(homepage.html)
    if (normalizeUrl(homepageCareersUrl) !== normalizeUrl(CAREERS_URL)) {
      throw new Error('Suzlon homepage no longer links to the verified first-party careers page')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Suzlon homepage now appears to expose a public jobs surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Suzlon verified official careers page no longer matches the trusted first-party surface')
    }

    if (hasPublicJobsSignal(careersPage.html)) {
      throw new Error('Suzlon verified official careers page now exposes public job listings')
    }

    for (const routeUrl of CHECKED_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (routePage.status !== 404 || hasPublicJobsSignal(routePage.html)) {
        throw new Error(`Suzlon verified missing route changed materially: ${routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createSuzlonSeForgeScraper().run(options)

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
