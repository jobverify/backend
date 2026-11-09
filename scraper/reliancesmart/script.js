import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { RELIANCE_SMART_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const BRAND_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const NO_PUBLIC_CAREER_ROUTE_URLS = PROVIDER_METADATA.verified404Routes

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bwe(?:'|’)?re hiring\b/i,
  /\bjoin our team\b/i,
  /\bopen positions\b/i,
  /\bcurrent openings\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /\bsearch jobs\b/i,
  /\bvacancies\b/i,
  /\bcareers\.ril\.com\b/i,
  /\blever\.co\b/i,
  /\bgreenhouse\.io\b/i,
  /\bashbyhq\.com\b/i,
  /\bworkdayjobs\.com\b/i,
  /\bmyworkdayjobs\.com\b/i,
  /\bsmartrecruiters\.com\b/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
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

export const hasOfficialBrandPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Reliance Retail\s*<\/title>/i.test(page)
    && text.includes('Reliance SMART')
    && text.includes('Reliance SMART is one of the largest & fastest growing Grocery retail chains in India.')
    && text.includes('SMART is a new age supermarket serving the needs of today’s smart and value seeking customers.')
    && text.includes('Smart Point')
    && text.includes('Our Brands')
}

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedMissingCareerRoute = (page = {}) => {
  const html = String(page?.html ?? '')
  const text = normalizeWhitespace(html)

  return Number(page?.status) === 404
    && /<title>\s*404\s*-\s*File or directory not found\.\s*<\/title>/i.test(html)
    && text.includes('Server Error')
    && text.includes('404 - File or directory not found.')
    && text.includes('The resource you are looking for might have been removed, had its name changed, or is temporarily unavailable.')
    && !hasPublicJobsSignal(html)
}

export const createRelianceSmartScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const brandPage = await fetchPage(BRAND_PAGE_URL)
    if (hasPublicJobsSignal(brandPage.html)) {
      throw new Error('Reliance Smart brand page now appears to expose public jobs')
    }

    if (brandPage.status !== 200 || !hasOfficialBrandPageSignal(brandPage.html)) {
      throw new Error('Reliance Smart verified official brand page no longer matches the trusted first-party surface')
    }

    for (const routeUrl of NO_PUBLIC_CAREER_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingCareerRoute(routePage)) {
        throw new Error(`Reliance Smart verified no-public-careers surface changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createRelianceSmartScraper().run(options)

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
