import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = 'testbook'
export const COMPANY = 'Testbook'
export const VERIFIED_ON = '2026-07-25'
export const OFFICIAL_SITE_URL = 'https://testbook.com/'
export const CAREERS_PAGE_URL = 'https://testbook.com/careers'
export const LEGACY_JOBS_URL = 'https://jobs.plutuseducation.com/'
export const TRAKSTAR_BOARD_URL = 'https://testbook.hire.trakstar.com/?q=&sort_by=most_recent&limit=25'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return text.includes('Careers - A Lifetime Opportunity to Shape Your Career | Testbook')
    && text.includes('Explore Open Positions')
    && text.includes('View open positions')
    && page.includes('https://jobs.plutuseducation.com')
    && page.includes(TRAKSTAR_BOARD_URL)
  }

export const hasLegacyJobsSiteNotFoundSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Site Not Found \| Framer\s*<\/title>/i.test(page)
    && text.includes('Site Not Found')
    && text.includes('There is no site configured at this address.')
  }

export const hasTrakstarUnverifiedSignal = (html = '') => {
  const text = normalizeWhitespace(html)

  return text.includes('Unverified account.')
    && text.includes('This employer is no longer using Trakstar Hire to collect applications.')
    && text.includes('Please contact the employer directly for information on how to apply.')
  }

export const createTestbookScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const careersPage = await fetchPage(CAREERS_PAGE_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersPageSignal(careersPage.html)) {
      throw new Error('Testbook verified careers page no longer matches the trusted first-party surface')
    }

    const legacyJobsPage = await fetchPage(LEGACY_JOBS_URL)
    if (legacyJobsPage.status !== 404 || !hasLegacyJobsSiteNotFoundSignal(legacyJobsPage.html)) {
      throw new Error('Testbook legacy jobs host changed materially and may now expose public jobs')
    }

    const trakstarPage = await fetchPage(TRAKSTAR_BOARD_URL)
    if (trakstarPage.status !== 404 || !hasTrakstarUnverifiedSignal(trakstarPage.html)) {
      throw new Error('Testbook Trakstar board changed materially and may now expose public jobs')
    }

    return []
  },
})

export const run = async (options = {}) => createTestbookScraper().run(options)

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
