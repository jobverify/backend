import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'swym'
export const COMPANY = 'Swym'
export const HOMEPAGE_URL = 'https://www.getswym.com/'
export const CAREERS_URL = 'https://www.getswym.com/careers'
export const JOBS_URL = 'https://www.getswym.com/jobs'
export const WELLFOUND_JOBS_URL = 'https://wellfound.com/company/swym/jobs'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const FETCH_TIMEOUT_MS = 15000

const createFetchTimeoutSignal = () => AbortSignal.timeout(FETCH_TIMEOUT_MS)

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/\u2019/g, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const containsAny = (value, patterns) => patterns.some((pattern) => pattern.test(value))

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    signal: createFetchTimeoutSignal(),
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
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return normalized.includes('swym - helping e-commerce brands craft a more seamless experience for their customers')
    && normalized.includes('helping e-commerce brands craft a more seamless experience for their customers')
    && normalized.includes('45k+ brands trust swym')
    && /https:\/\/www\.getswym\.com/i.test(page)
    && /rel=["']canonical["']/i.test(page)
    && /"name"\s*:\s*"Swym"/i.test(page)
    && /href=["']\/careers["']/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()
  const handoffMatches = page.match(/https:\/\/wellfound\.com\/company\/swym\/jobs/gi) ?? []

  return normalized.includes('careers at swym')
    && normalized.includes('come win with us')
    && normalized.includes('remote-first')
    && normalized.includes('global team')
    && normalized.includes('competitive compensation')
    && containsAny(normalized, [/\bflexible pto\b/i, /\bflexible time off\b/i, /\b20 days of pto\b/i])
    && containsAny(normalized, [/\bhealth benefits\b/i, /\bhealth & wellness\b/i, /\bhealth insurance\b/i])
    && normalized.includes('view current openings')
    && /https:\/\/www\.getswym\.com\/careers/i.test(page)
    && /rel=["']canonical["']/i.test(page)
    && handoffMatches.length >= 1
}

export const hasOfficialJobs404Signal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return normalized.includes('not found')
    && normalized.includes("we've looked everywhere!")
    && normalized.includes('page not found')
    && normalized.includes('go to homepage')
    && /https:\/\/www\.getswym\.com\/404/i.test(page)
    && /rel=["']canonical["']/i.test(page)
}

export const hasUnexpectedCareersHandoff = (html) => {
  const page = String(html ?? '')
  const hasVerifiedWellfoundHandoff = page.includes(WELLFOUND_JOBS_URL)

  if (!hasVerifiedWellfoundHandoff) {
    return true
  }

  return /https:\/\/(?:boards\.greenhouse\.io|job-boards\.greenhouse\.io|jobs\.lever\.co|jobs\.ashbyhq\.com|(?:[^"' ]+\.)?myworkdayjobs\.com|(?:[^"' ]+\.)?workdayjobs\.com|smartrecruiters\.com|recruitcrm\.io|recruitcrm\.com|freshteam\.com)/i.test(page)
    || /href=["']https:\/\/www\.getswym\.com\/jobs(?:\/|["'])/i.test(page)
}

export const createSwymScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Swym verified official homepage no longer matches the trusted first-party surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html) || hasUnexpectedCareersHandoff(careersPage.html)) {
      throw new Error('Swym verified careers handoff no longer matches the trusted first-party surface')
    }

    const jobsRoute = await fetchPage(JOBS_URL)
    if (jobsRoute.status !== 404 || !hasOfficialJobs404Signal(jobsRoute.html)) {
      throw new Error('Swym verified first-party jobs route no longer matches the trusted 404 surface')
    }

    return []
  },
})

export const run = async (options = {}) => createSwymScraper().run(options)

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
