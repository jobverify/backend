import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ETON_SOLUTIONS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = ETON_SOLUTIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREER_PAGE_URL = PROVIDER_METADATA.careerPageUrl
export const ROBOTS_TXT_URL = PROVIDER_METADATA.robotsTxtUrl
export const WP_SITEMAP_URL = PROVIDER_METADATA.wpSitemapUrl
export const CHECKED_404_ROUTE_URLS = [...PROVIDER_METADATA.checked404RouteUrls]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CHECKED_MISSING_CRAWL_URLS = [
  ROBOTS_TXT_URL,
  WP_SITEMAP_URL,
]

const CAREERS_LINK_PATTERNS = [
  /\/careers?(?:\/|$)/i,
  /\/jobs?(?:\/|$)/i,
  /\/join-us(?:\/|$)/i,
  /\/work-with-us(?:\/|$)/i,
  /\/openings?(?:\/|$)/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /smartrecruiters/i,
  /jobvite/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /darwinbox/i,
  /peoplestrong/i,
  /successfactors/i,
  /oraclecloud/i,
  /linkedin\.com\/jobs/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1]) || null
}

const extractLinks = (html = '') => (
  [...String(html ?? '').matchAll(/href=["']([^"'#]+)["']/gi)]
    .map((match) => match[1].trim())
    .filter(Boolean)
)

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

export const hasPublicAtsOrCareersLink = (html = '') =>
  extractLinks(html).some((link) => CAREERS_LINK_PATTERNS.some((pattern) => pattern.test(link)))

export const hasHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return extractTitle(rawHtml) === 'Website Designing & Best Digital Marketing Company in Delhi - Eton Solutions'
    && normalized.includes('info@etonsolutions.com')
    && normalized.includes('+91-96500 96446')
    && normalized.includes('Best Digital Marketing Company in Delhi: ETON Solutions')
    && normalized.includes('Providing The Cutting Edge Web Solutions')
    && rawHtml.includes('https://www.etonsolutions.com/about-us')
    && rawHtml.includes('https://www.etonsolutions.com/contact-us')
    && !hasPublicAtsOrCareersLink(rawHtml)
}

export const isExpectedMissingRoute = (page = {}) =>
  Number(page?.status) === 404 && !hasPublicAtsOrCareersLink(page?.html)

export const createEtonSolutionsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (Number(homepage.status) !== 200 || !hasHomepageSignal(homepage.html)) {
      throw new Error('Eton Solutions verified homepage no longer matches the known first-party surface')
    }

    for (const routeUrl of CHECKED_MISSING_CRAWL_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isExpectedMissingRoute(routePage)) {
        throw new Error(`Eton Solutions missing crawl routes changed: ${routeUrl}`)
      }
    }

    for (const routeUrl of CHECKED_404_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isExpectedMissingRoute(routePage)) {
        throw new Error(`Eton Solutions verified 404 careers route changed: ${routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createEtonSolutionsScraper().run(options)

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
