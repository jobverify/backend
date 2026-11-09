import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'blinkit'
export const COMPANY = 'Blinkit'
export const HOMEPAGE_URL = 'https://blinkit.com/'
export const JOBS_URL = 'https://blinkit.com/careers/jobs'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html = '') => normalizeWhitespace(
  String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '',
)

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
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()
  const title = extractTitle(rawHtml)

  return (/^blinkit:/i.test(title) || /blinkit/i.test(title))
    && normalized.includes('blinkit')
    && (
      normalized.includes('minutes')
      || normalized.includes('products delivered to your doorstep')
      || normalized.includes('instant delivery service in india')
    )
  }

export const extractJobCards = (html) =>
  Array.from(
    String(html ?? '').matchAll(/<a\b[^>]+(?:class="[^"]*job-card[^"]*"|href="[^"]*\/careers\/job[^"]*")[^>]*>/gi),
  )

export const hasOpenJobCards = (html) => extractJobCards(html).length > 0

export const isOfficialAccessDeniedPage = (page = {}) => {
  const html = String(page.html ?? '')
  const normalized = normalizeWhitespace(html).toLowerCase()

  return Number(page.status) === 403
    && /<title[^>]*>\s*blinkit\s*\|\s*Error Page\s*<\/title>/i.test(html)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https?:\/\/blinkit\.com\/careers\/error-page["']/i.test(html)
    && normalized.includes('access denied')
    && normalized.includes('you have been blocked')
}

const buildOfficialAccessDeniedError = () => {
  const error = new Error('Blinkit official careers page is access denied by the upstream site')
  error.softFailure = true
  error.upstreamOutage = true
  return error
}

export const hasVerifiedJobsShellSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()
  const title = extractTitle(rawHtml)

  return (/Careers Opportunities, Current Job Openings/i.test(title) || /^blinkit\s*\|\s*careers$/i.test(title))
    && normalized.includes('0 job positions')
    && normalized.includes('0 of 0 results')
    && (normalized.includes('open positions') || normalized.includes('choose a location'))
    && (normalized.includes('locations') || normalized.includes('choose a location'))
    && (normalized.includes('teams') || normalized.includes('choose a team'))
    && (
      normalized.includes('see where you fit in')
      || normalized.includes('job listing')
      || normalized.includes('search jobs')
    )
  }

export const createBlinkitScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    const homepageIsDenied = isOfficialAccessDeniedPage(homepage)

    if (!homepageIsDenied && (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html))) {
      throw new Error('Blinkit verified official homepage no longer matches the known public surface')
    }

    const jobsPage = await fetchPage(JOBS_URL)
    const jobsPageIsDenied = isOfficialAccessDeniedPage(jobsPage)

    if (homepageIsDenied || jobsPageIsDenied) {
      if (homepageIsDenied && jobsPageIsDenied) {
        return []
      }

      throw buildOfficialAccessDeniedError()
    }

    if (jobsPage.status !== 200 || !hasVerifiedJobsShellSignal(jobsPage.html)) {
      throw new Error('Blinkit verified first-party jobs surface no longer matches the known zero-openings shell')
    }

    if (hasOpenJobCards(jobsPage.html)) {
      throw new Error('Blinkit jobs surface changed materially or now exposes public openings')
    }

    return []
  },
})

export const run = async (options = {}) => createBlinkitScraper().run(options)

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
