import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'ramcocements'
export const COMPANY = 'The Ramco Cements Limited'
export const HOMEPAGE_URL = 'https://www.ramcocements.in/'
export const LIFE_AT_RAMCO_URL = 'https://www.ramcocements.in/about/life-at-ramco'
export const CAREERS_ROUTE_URLS = [
  'https://www.ramcocements.in/careers',
  'https://www.ramcocements.in/career',
  'https://www.ramcocements.in/jobs',
  'https://www.ramcocements.in/job',
  'https://www.ramcocements.in/apply',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_SIGNAL_PATTERNS = [
  /\bthe ramco cements limited\b/i,
  /\bfake job disclaimer\b/i,
  /linkedin\.com\/company\/(?:the-ramco-cements-limited|theramcocementsltd)/i,
]

const LIFE_AT_RAMCO_SIGNAL_PATTERNS = [
  /\blife at ramco\b/i,
  /\bfake job disclaimer\b/i,
  /\bramco\b/i,
]

const MISSING_ROUTE_PATTERN = /\b404\b|\bpage not found\b|\bcould not be found\b|\bnot found\b/i
const PUBLIC_CAREERS_SIGNAL_PATTERN =
  /\b(career|careers|open positions|job opening|job openings|join us|join our team|work with us|we are hiring|hiring now|apply now)\b/i

const normalizeText = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractNextPageKey = (html) => {
  const nextDataMatch = String(html ?? '').match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/is)
  if (!nextDataMatch) return null

  try {
    const nextData = JSON.parse(nextDataMatch[1])
    return typeof nextData?.page === 'string' ? nextData.page : null
  } catch {
    return null
  }
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) =>
  extractNextPageKey(html) === '/'
  && HOMEPAGE_SIGNAL_PATTERNS.every((pattern) => pattern.test(String(html ?? '')))

export const hasLifeAtRamcoSignal = (html) =>
  extractNextPageKey(html) === '/about/life-at-ramco'
  && LIFE_AT_RAMCO_SIGNAL_PATTERNS.every((pattern) => pattern.test(String(html ?? '')))

export const hasMissingRouteSignal = ({ status, html }) => {
  const normalized = normalizeText(html).toLowerCase()

  return status === 404
    && MISSING_ROUTE_PATTERN.test(normalized)
    && !PUBLIC_CAREERS_SIGNAL_PATTERN.test(normalized)
}

export const createRamcoCementsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('The Ramco Cements Limited homepage no longer matches the verified official public surface')
    }

    const lifeAtRamco = await fetchPage(LIFE_AT_RAMCO_URL)

    if (!hasLifeAtRamcoSignal(lifeAtRamco.html)) {
      throw new Error('The Ramco Cements Limited Life at Ramco page no longer matches the verified official public surface')
    }

    const routes = await Promise.all(CAREERS_ROUTE_URLS.map((url) => fetchPage(url)))

    if (!routes.every(hasMissingRouteSignal)) {
      throw new Error('The Ramco Cements Limited public careers surface changed')
    }

    return []
  },
})

export const run = async (options = {}) => createRamcoCementsScraper().run(options)

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
