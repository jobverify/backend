import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'hhvatindustrial'
export const COMPANY = 'HHVAT Industrial'
export const HOMEPAGE_URL = 'https://hhvat.com/'
export const LANDER_URL = 'https://hhvat.com/lander'
export const PUBLIC_JOB_ROUTE_URLS = [
  'https://hhvat.com/careers',
  'https://hhvat.com/jobs',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

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

export const hasHomepageRedirectSignal = (html = '') => {
  const page = String(html ?? '')

  return /window\.onload\s*=\s*function\s*\(\)\s*\{\s*window\.location\.href\s*=\s*["']\/lander["']\s*\}/i.test(page)
}

export const hasParkedLanderSignal = (html = '') => {
  const page = String(html ?? '')

  return /window\.LANDER_SYSTEM\s*=\s*["']PW["']/i.test(page)
    && /_trfd\.push\(\{ap:["']parking["']\}\)/i.test(page)
    && /img1\.wsimg\.com\/signals\/js\/clients\/scc-c2\/scc-c2\.min\.js/i.test(page)
}

export const createHhvatIndustrialScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasHomepageRedirectSignal(homepage.html)) {
      throw new Error('HHVAT Industrial verified official homepage no longer matches the known parked-domain handoff')
    }

    const lander = await fetchPage(LANDER_URL)
    if (lander.status !== 200 || !hasParkedLanderSignal(lander.html)) {
      throw new Error('HHVAT Industrial verified parked landing page no longer matches the trusted zero-jobs state')
    }

    for (const routeUrl of PUBLIC_JOB_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (routePage.status !== 200 || !hasHomepageRedirectSignal(routePage.html)) {
        throw new Error(`HHVAT Industrial public jobs route ${routeUrl} no longer matches the verified zero-jobs redirect shell`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createHhvatIndustrialScraper().run(options)

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
