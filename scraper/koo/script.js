import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { KOO_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = KOO_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const ALTERNATE_HOMEPAGE_URL = PROVIDER_METADATA.alternateHomepageUrl
export const VERIFIED_BROKEN_ROUTE_URLS = PROVIDER_METADATA.verifiedBrokenRouteUrls

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const ATS_SIGNAL_PATTERN =
  /boards\.greenhouse\.io|jobs\.lever\.co|ashbyhq\.com|myworkdayjobs|workdayjobs|smartrecruiters|jobvite|icims|taleo|darwinbox|successfactors|oraclecloud/i

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

export const hasVerifiedBrokenWixSignal = (html = '') => {
  const page = String(html ?? '')
  const title = extractTitle(page) || ''
  const normalized = (normalizeWhitespace(page) || '').toLowerCase()

  return /wix\.com$/i.test(title)
    && normalized.includes('wix.com')
    && (
      normalized.includes('connectyourdomain error')
      || normalized.includes("domain isn't connected to a website yet")
      || normalized.includes('404 error')
      || normalized.includes('page not found')
    )
}

export const hasPublicJobBoardSignal = (html = '') => {
  const page = String(html ?? '')

  return ATS_SIGNAL_PATTERN.test(page)
    || /JobPosting/i.test(page)
    || /\b(Current Openings|Open Positions|Vacancies|Apply now)\b/i.test(page)
    || /href=["']https?:\/\/(?:www\.)?kooapp\.com\/(?:careers?|jobs?)(?:\/[^"']*)?["']/i.test(page)
  }

export const isVerifiedBrokenPage = (page = {}) =>
  Number(page.status) === 404
  && hasVerifiedBrokenWixSignal(page.html)
  && !hasPublicJobBoardSignal(page.html)

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

export const createKooScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    for (const url of [HOMEPAGE_URL, ALTERNATE_HOMEPAGE_URL]) {
      const page = await fetchPage(url)
      if (!isVerifiedBrokenPage(page)) {
        throw new Error(`Koo verified broken first-party domain no longer matches the verified public surface: ${url}`)
      }
    }

    for (const url of VERIFIED_BROKEN_ROUTE_URLS) {
      const page = await fetchPage(url)
      if (!isVerifiedBrokenPage(page)) {
        throw new Error(`Koo verified broken route changed materially or now exposes public jobs: ${url}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createKooScraper().run(options)

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
