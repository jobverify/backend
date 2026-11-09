import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { AMBRANE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = AMBRANE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREER_PAGE_URL = PROVIDER_METADATA.careerPageUrl
export const SITEMAP_URL = PROVIDER_METADATA.sitemapUrl
export const CHECKED_MISSING_ROUTE_URLS = [...PROVIDER_METADATA.checkedMissingRouteUrls]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bjobposting\b/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /smartrecruiters/i,
  /jobvite/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /darwinbox/i,
  /icims/i,
  /successfactors/i,
  /oraclecloud/i,
  /\bvacanc(?:y|ies)\b/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1]) || null
}

const isOfficialDomainUrl = (value) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === 'ambraneindia.com' || hostname === 'www.ambraneindia.com'
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
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return extractTitle(rawHtml) === 'Ambrane India - Shop Power Banks, Cable, Chargers & Other Accessories'
    && normalized.includes('Warranty registration')
    && normalized.includes('Corporate Enquiries')
    && normalized.includes('Subscribe to our newsletter')
    && /care@ambraneindia\.com/i.test(rawHtml)
    && /shopify-section/i.test(rawHtml)
    && /myshopify/i.test(rawHtml)
}

export const hasEmptyCareerShellSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return extractTitle(rawHtml) === 'Career'
    && /<meta[^>]+name=["']robots["'][^>]+content=["']noindex,\s*nofollow["']/i.test(rawHtml)
    && /<meta[^>]+property=["']og:url["'][^>]+content=["']https:\/\/ambraneindia\.com\/pages\/career["']/i.test(rawHtml)
    && /<meta[^>]+name=["']keywords["'][^>]+content=["'][^"']*Career,\s*Ambrane India,\s*ambraneindia\.com/i.test(rawHtml)
    && /template-page/i.test(rawHtml)
    && /<main[^>]+id=["']MainContent["']/i.test(rawHtml)
    && normalized.includes('Warranty registration')
    && normalized.includes('Corporate Enquiries')
    && normalized.includes('Subscribe to our newsletter')
    && /care@ambraneindia\.com/i.test(rawHtml)
    && !hasPublicJobsSignal(rawHtml)
}

export const extractCareerLikeUrlsFromSitemap = (sitemapXml = '') => (
  [...String(sitemapXml ?? '').matchAll(/https:\/\/ambraneindia\.com\/[^<\s]+/gi)]
    .map((match) => match[0].replace(/&amp;/gi, '&'))
    .filter((url) => /\/(?:pages\/)?(?:career|careers|jobs?|join-us|openings)(?:[/?#]|$)/i.test(url))
)

export const isMissingCareerRoute = (page = {}) =>
  Number(page.status) === 404
  && isOfficialDomainUrl(page.url || '')
  && extractTitle(page.html) === '404 Not Found'
  && !hasPublicJobsSignal(page.html)

export const createAmbraneScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Ambrane verified official homepage no longer matches the known first-party surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Ambrane homepage now appears to expose public jobs')
    }

    const careerPage = await fetchPage(CAREER_PAGE_URL)

    if (careerPage.status !== 200 || !hasEmptyCareerShellSignal(careerPage.html)) {
      throw new Error('Ambrane verified empty career page no longer matches the known first-party surface')
    }

    for (const routeUrl of CHECKED_MISSING_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (!isMissingCareerRoute(routePage)) {
        throw new Error(`Ambrane verified missing career route changed: ${routePage.url || routeUrl}`)
      }
    }

    const sitemapPage = await fetchPage(SITEMAP_URL)
    const careerLikeUrls = extractCareerLikeUrlsFromSitemap(sitemapPage.html)

    if (sitemapPage.status !== 200 || careerLikeUrls.length > 0) {
      throw new Error('Ambrane verified sitemap career surface changed')
    }

    return []
  },
})

export const run = async (options = {}) => createAmbraneScraper().run(options)

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
