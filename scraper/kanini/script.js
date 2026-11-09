import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'kanini'
export const COMPANY = 'KANINI SOFTWARE SOLUTIONS'
export const HOMEPAGE_URL = 'https://kanini.com/'
export const CAREERS_URL = 'https://kanini.com/careers/'
export const OPEN_POSITIONS_URL = 'https://kanini.com/careers/open-positions/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;/gi, "'")
    .replace(/[‘’]/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeText = (value) => normalizeWhitespace(value).toLowerCase()

const normalizeComparableUrl = (value) => String(value ?? '')
  .trim()
  .replace(/\/+$/, '')

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeText(rawHtml)
  const hasCanonicalHome = /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/kanini\.com\/?["']/i.test(rawHtml)
  const hasCareersLink = /href=["'][^"']*\/careers\/?["']/i.test(rawHtml)
  const hasOpenPositionsLink = /href=["'][^"']*\/careers\/open-positions\/?["']/i.test(rawHtml)
  const hasLegacyHero = normalized.includes('trailblazers of digital transformation')
    && normalized.includes('creating the roadmap for businesses to become truly future-ready')
  const hasCurrentHero = normalized.includes('your partner in ai journey')
    && normalized.includes("let's blaze the trail for tomorrow's transformation")

  return hasCanonicalHome
    && hasCareersLink
    && hasOpenPositionsLink
    && normalized.includes('get agile. go digital.')
    && normalized.includes('kanini software solutions inc')
    && (hasLegacyHero || hasCurrentHero)
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeText(html)

  return normalized.includes('welcome to the happier way to work')
    && normalized.includes('at kanini, we are building a more human tech.')
    && normalized.includes('our people come to work because it makes them happy.')
    && normalized.includes('explore our open positions')
}

export const extractOpenPositionsUrl = (html) => {
  const page = String(html ?? '')
  const patterns = [
    /<a[^>]+href="([^"]*\/careers\/open-positions\/?)"[^>]*>[\s\S]*?<\/a>/i,
    /<a[^>]+href="([^"]+)"[^>]*>\s*view open positions\s*<\/a>/i,
    /<a[^>]+href="([^"]+)"[^>]*>\s*join us\s*<\/a>/i,
  ]

  for (const pattern of patterns) {
    const match = page.match(pattern)
    if (!match) continue

    try {
      return new URL(match[1], CAREERS_URL).toString()
    } catch {
      return null
    }
  }

  return null
}

export const hasZeroJobsSignal = (html) => {
  const normalized = normalizeText(html)

  return normalized.includes('explore our open positions')
    && normalized.includes('stay connected with us')
    && normalized.includes('submit your profile for future opportunities')
    && normalized.includes('all locations india ukraine united states uk colombia')
    && normalized.includes("we're sorry. we were not able to find a match.")
}

export const createKaniniScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('KANINI verified official homepage no longer matches the known public surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('KANINI verified careers page no longer matches the known public surface')
    }

    const openPositionsUrl = extractOpenPositionsUrl(careersHtml)
    if (normalizeComparableUrl(openPositionsUrl) !== normalizeComparableUrl(OPEN_POSITIONS_URL)) {
      throw new Error('KANINI careers page no longer links to the verified official open positions surface')
    }

    const openPositionsHtml = await fetchText(OPEN_POSITIONS_URL)
    if (!hasZeroJobsSignal(openPositionsHtml)) {
      throw new Error('KANINI public jobs surface no longer matches the verified zero-job state')
    }

    return []
  },
})

export const run = async (options = {}) => createKaniniScraper().run(options)

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
