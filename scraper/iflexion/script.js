import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { IFLEXION_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = IFLEXION_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const SITEMAP_URL = PROVIDER_METADATA.sitemapUrl
export const NO_PUBLIC_JOB_ROUTE_URLS = PROVIDER_METADATA.noPublicJobRouteUrls

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const ATS_SIGNAL_PATTERN =
  /boards\.greenhouse\.io|jobs\.lever\.co|ashbyhq\.com|myworkdayjobs|workdayjobs|smartrecruiters|jobvite|icims|taleo|darwinbox|successfactors|oraclecloud/i

const DIRECT_CAREER_PATH_PATTERN =
  /^\/(?:careers?|jobs?|careers-and-jobs|join-us|work-with-us|vacancy|vacancies)\/?$/i

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const extractTitle = (html = '') => normalizeWhitespace(
  String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],
)

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = (normalizeWhitespace(page) || '').toLowerCase()
  const title = extractTitle(page) || ''

  return title === 'Custom Software Development | Iflexion'
    && normalized.includes('iflexion')
    && normalized.includes('portfolio')
    && normalized.includes('how we work')
    && normalized.includes('contact us')
    && normalized.includes('custom software')
  }

export const hasPublicJobBoardSignal = (html = '') => {
  const page = String(html ?? '')

  return ATS_SIGNAL_PATTERN.test(page)
    || /JobPosting/i.test(page)
    || /\b(Current Openings|Open Positions|Vacancies|Apply now)\b/i.test(page)
    || /href=["']https?:\/\/www\.iflexion\.com\/(?:careers?|jobs?|careers-and-jobs)(?:\/[^"']*)?["']/i.test(page)
  }

export const hasExpectedSitemap = (xml = '') => {
  const urls = [...String(xml ?? '').matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)]
    .map((match) => String(match[1] ?? '').trim())
    .filter(Boolean)

  if (urls.length === 0) return false

  const normalized = urls.map((url) => url.toLowerCase())

  return normalized.includes('https://www.iflexion.com/')
    && normalized.includes('https://www.iflexion.com/portfolio')
    && normalized.includes('https://www.iflexion.com/services/custom-software-development')
    && urls.every((url) => {
      try {
        return !DIRECT_CAREER_PATH_PATTERN.test(new URL(url).pathname)
      } catch {
        return false
      }
    })
  }

export const isVerifiedNoPublicJobRoute = (page = {}) => {
  const title = extractTitle(page.html) || ''
  const normalized = (normalizeWhitespace(page.html) || '').toLowerCase()

  return Number(page.status) === 404
    && title === 'Page not found'
    && normalized.includes('iflexion')
    && normalized.includes('page not found')
    && !hasPublicJobBoardSignal(page.html)
}

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

export const createIflexionScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      homepage.status !== 200
      || !hasOfficialHomepageSignal(homepage.html)
      || hasPublicJobBoardSignal(homepage.html)
    ) {
      throw new Error('Iflexion official homepage no longer matches the verified first-party no-public-jobs surface')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (sitemap.status !== 200 || !hasExpectedSitemap(sitemap.html)) {
      throw new Error('Iflexion sitemap no longer matches the verified first-party no-careers route set')
    }

    for (const routeUrl of NO_PUBLIC_JOB_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedNoPublicJobRoute(routePage)) {
        throw new Error(`Iflexion common job route changed materially or now exposes public jobs: ${routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createIflexionScraper().run(options)

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
