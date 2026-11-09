import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { PVR_INOX_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = PVR_INOX_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_ROUTE_URLS = [...PROVIDER_METADATA.careerRouteUrls]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&#8217;|&rsquo;/gi, "'")
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(String(value ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtml(String(value ?? ''))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

export const hasGenericSpaShellSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /meta[^>]+name=["']description["'][^>]+Book movie tickets online at PVR Cinemas\./i.test(page)
    && /meta[^>]+property=["']og:title["'][^>]+Book Movie Tickets Online \| PVR INOX Cinemas/i.test(page)
    && /meta[^>]+property=["']og:url["'][^>]+https:\/\/www\.inoxmovies\.com\//i.test(page)
    && /meta[^>]+property=["']og:site_name["'][^>]+PVR INOX Cinemas/i.test(page)
    && /<div[^>]+id=["']root["'][^>]*><\/div>/i.test(page)
    && /\/static\/js\/main\.[a-z0-9]+\.js/i.test(page)
    && text.includes('You need to enable JavaScript to run this app.')
}

export const hasPublicJobsSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /"@type"\s*:\s*"JobPosting"/i.test(page)
    || /(jobs\.lever\.co|boards\.greenhouse\.io|job-boards\.greenhouse\.io|ashbyhq\.com|myworkdayjobs|workdayjobs|smartrecruiters|jobvite|darwinbox)/i.test(page)
    || /\b(current openings|open positions|job openings|search jobs|view jobs|apply now|join our team)\b/i.test(text)
    || /<article\b/i.test(page)
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

export const createPvrInoxScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    for (const routeUrl of CAREERS_ROUTE_URLS) {
      const page = await fetchPage(routeUrl)

      if (hasPublicJobsSignal(page.html)) {
        throw new Error(`PVR INOX public jobs surface detected on verified careers route: ${routeUrl}`)
      }

      if (Number(page.status) !== 200 || !hasGenericSpaShellSignal(page.html)) {
        throw new Error(`PVR INOX verified careers route changed materially: ${routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createPvrInoxScraper().run(options)

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
