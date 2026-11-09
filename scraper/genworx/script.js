import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const SOURCE = 'genworx'
export const COMPANY = 'Genworx'
export const HOME_URL = 'https://genworx.ai/'
export const CAREERS_URL = 'https://genworx.ai/careers'
export const JOBS_URL = 'https://genworx.ai/jobs'
export const CAREER_URL = 'https://genworx.ai/career'
export const JOIN_US_URL = 'https://genworx.ai/join-us'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const EXPECTED_STATIC_ROUTES = [
  '/',
  '/about',
  '/contact',
  '/blog',
  '/blog/:slug',
  '/how-we-deliver',
  '/genies/timeiq',
  '/team',
  '*',
]

const CHECKED_ROUTE_URLS = [
  CAREERS_URL,
  JOBS_URL,
  CAREER_URL,
  JOIN_US_URL,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const buildBundleUrl = (bundlePath) => new URL(bundlePath, HOME_URL).toString()

const hasSameValues = (actual, expected) =>
  actual.length === expected.length && actual.every((value, index) => value === expected[index])

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return normalized.includes('genworx.ai — simplifying ai. amplifying success.')
    && /<meta[\s\S]*name=["']description["'][\s\S]*content=["']Genworx\.ai simplifies AI and amplifies success with production-ready solutions for operations, finance, and IT teams\.["']/i.test(page)
    && /<meta\s+name=["']author["']\s+content=["']Genworx\.ai["']/i.test(page)
    && /<div\s+id=["']root["']/.test(page)
    && /<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']\/assets\/[^"']+\.js["']/.test(page)
}

export const extractBundlePath = (html) => {
  const match = /<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["'](\/assets\/[^"']+\.js)["']/i.exec(
    String(html ?? ''),
  )

  return match?.[1] ?? null
}

export const extractStaticRoutes = (bundleJs) => {
  const routes = []
  const seen = new Set()
  const routeRegex = /path:"([^"]+)"/g

  for (const match of String(bundleJs ?? '').matchAll(routeRegex)) {
    const route = normalizeWhitespace(match[1])
    if (!route || seen.has(route)) continue
    seen.add(route)
    routes.push(route)
  }

  return routes
}

const hasPublicCareersRoute = (routes) =>
  routes.some((route) => /^\/(?:careers?|jobs?|join-us)(?:\/|$)/i.test(route))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createGenworxScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOME_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Genworx official homepage changed; refusing to assume there is still no public careers surface')
    }

    const bundlePath = extractBundlePath(homepageHtml)
    if (!bundlePath) {
      throw new Error('Genworx homepage no longer exposes the verified client bundle')
    }

    const bundleUrl = buildBundleUrl(bundlePath)
    const bundleJs = await fetchText(bundleUrl)
    const routes = extractStaticRoutes(bundleJs)

    if (hasPublicCareersRoute(routes)) {
      throw new Error('Genworx now exposes a public careers route in its first-party route bundle')
    }

    if (!hasSameValues(routes, EXPECTED_STATIC_ROUTES)) {
      throw new Error('Genworx public route bundle changed; refusing to assume the careers surface is still absent')
    }

    for (const routeUrl of CHECKED_ROUTE_URLS) {
      const routeHtml = await fetchText(routeUrl)
      if (!hasOfficialHomepageSignal(routeHtml) || extractBundlePath(routeHtml) !== bundlePath) {
        throw new Error(`Genworx first-party route now differs from the verified marketing shell: ${routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createGenworxScraper().run(options)

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
