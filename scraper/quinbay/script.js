import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'quinbay'
export const COMPANY = 'Quinbay Technologies'
export const HOMEPAGE_URL = 'https://quinbay.com/'
export const CAREERS_URL = 'https://quinbay.com/careers/'
export const JOBS_URL = 'https://quinbay.com/jobs/'
export const SITEMAP_URL = 'https://quinbay.com/sitemap.xml'
export const BLOCKED_LANDER_URL = 'https://quinbay.com/lander'
export const BLOCKED_REASON =
  'Official quinbay.com routes currently redirect to a parked /lander page and expose no public careers or apply surface.'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /\bview jobs\b/i,
  /\bsearch jobs\b/i,
  /\bjob description\b/i,
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
]

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const isSameOfficialHost = (value) => {
  try {
    return new URL(value || HOMEPAGE_URL).hostname === 'quinbay.com'
  } catch {
    return false
  }
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const extractRedirectTarget = (html, sourceUrl = HOMEPAGE_URL) => {
  const match = String(html ?? '').match(/window\.location\.href\s*=\s*["']([^"']+)["']/i)
  if (!match?.[1]) {
    return null
  }

  try {
    return new URL(match[1], sourceUrl).toString()
  } catch {
    return null
  }
}

export const extractSitemapUrls = (xml) =>
  [...String(xml ?? '').matchAll(/<loc>([^<]+)<\/loc>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)

export const hasParkedLanderSignal = ({ status, url, html } = {}) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return Number(status) === 200
    && url === BLOCKED_LANDER_URL
    && isSameOfficialHost(url)
    && !hasPublicJobsSignal(page)
    && /window\.LANDER_SYSTEM\s*=\s*["']PW["']/i.test(page)
    && normalized.includes('parking')
    && /img1\.wsimg\.com/i.test(page)
    && /parking-lander/i.test(page)
    && /<div[^>]+id=["']root["'][^>]*><\/div>/i.test(page)
}

const isBlockedOfficialRoute = (page = {}, expectedUrl) =>
  Number(page.status) === 200
  && page.url === expectedUrl
  && isSameOfficialHost(page.url)
  && !hasPublicJobsSignal(page.html)
  && extractRedirectTarget(page.html, expectedUrl) === BLOCKED_LANDER_URL

export const createQuinbayScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (!isBlockedOfficialRoute(homepage, HOMEPAGE_URL)) {
      throw new Error('Quinbay verified official homepage changed materially or now exposes public jobs')
    }

    const careers = await fetchPage(CAREERS_URL)
    if (!isBlockedOfficialRoute(careers, CAREERS_URL)) {
      throw new Error('Quinbay verified official careers route changed materially or now exposes public jobs')
    }

    const jobs = await fetchPage(JOBS_URL)
    if (!isBlockedOfficialRoute(jobs, JOBS_URL)) {
      throw new Error('Quinbay verified official jobs route changed materially or now exposes public jobs')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    const sitemapUrls = extractSitemapUrls(sitemap.html)
    if (
      Number(sitemap.status) !== 200
      || sitemap.url !== SITEMAP_URL
      || sitemapUrls.length !== 1
      || sitemapUrls[0] !== BLOCKED_LANDER_URL
    ) {
      throw new Error('Quinbay verified official sitemap changed materially or now exposes additional public routes')
    }

    const blockedLander = await fetchPage(BLOCKED_LANDER_URL)
    if (!hasParkedLanderSignal(blockedLander)) {
      throw new Error('Quinbay blocked lander no longer matches the verified parked non-public surface')
    }

    return []
  },
})

export const run = async (options = {}) => createQuinbayScraper().run(options)

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
