import path from 'node:path'
import { fileURLToPath } from 'node:url'

import EDELWEISS_CATALOG, { VERIFIED_SURFACE_SUMMARY } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = EDELWEISS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const ROOT_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const APPLICATION_EMAIL = PROVIDER_METADATA.applicationEmail
export const APPLICATION_URL = PROVIDER_METADATA.applicationUrl
export const SITEMAP_URL = 'https://www.edelweissfin.com/sitemap.xml'
export const SITEMAP_INDEX_URL = 'https://www.edelweissfin.com/sitemap_index.xml'
export const ROBOTS_URL = 'https://www.edelweissfin.com/robots.txt'
export { VERIFIED_SURFACE_SUMMARY }

export const VERIFIED_ROUTE_URLS = [
  ROOT_URL,
  CAREERS_URL,
  ROBOTS_URL,
  SITEMAP_URL,
  'https://www.edelweissfin.com/careers',
  'https://www.edelweissfin.com/career',
  'https://www.edelweissfin.com/jobs',
  'https://www.edelweissfin.com/join-us',
  'https://www.edelweissfin.com/work-with-us',
]

export const BLOCKED_ROUTE_URLS = VERIFIED_ROUTE_URLS

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
  /\bopen roles\b/i,
  /\bapply now\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /workdayjobs/i,
  /myworkdayjobs/i,
  /smartrecruiters/i,
  /darwinbox/i,
  /jobvite/i,
  /icims/i,
  /taleo/i,
  /peoplestrong/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
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

const isFirstPartyUrl = (value) => {
  try {
    const parsed = new URL(value)
    return parsed.hostname === 'www.edelweissfin.com'
  } catch {
    return false
  }
}

export const hasPublicJobListingSignal = (html = '') =>
  PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return extractTitle(rawHtml) === 'Top Finance Company in Mumbai, India | Best in Investment & Advisory Services - Edelweiss Finance'
    && /href=["']\/edelweisscareers["'][^>]*>\s*Careers\s*<\/a>/i.test(rawHtml)
    && normalized.includes('Top Finance Company in Mumbai, India')
    && !hasPublicJobListingSignal(rawHtml)
}

export const hasVerifiedInformationalCareersSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return extractTitle(rawHtml) === 'Careers At Edelweiss'
    && /CAREERS AT EDELWEISS/i.test(normalized)
    && /LIFE AT EDELWEISS/i.test(normalized)
    && /Want to join the Edelweiss family\?/i.test(normalized)
    && /GroupTalent\.Acquisition@edelweissfin\.com/i.test(normalized)
    && !hasPublicJobListingSignal(rawHtml)
}

export const hasMissingRobotsSignal = (page = {}) =>
  Number(page?.status) === 404
  && extractTitle(page?.html) === '404 Not Found'
  && !hasPublicJobListingSignal(page?.html)

export const hasVerifiedSitemapSignal = (page = {}) => {
  const rawHtml = String(page?.html ?? '')

  return Number(page?.status) === 200
    && page?.url === SITEMAP_INDEX_URL
    && /https:\/\/www\.edelweissfin\.com\/post-sitemap\.xml/i.test(rawHtml)
    && /https:\/\/www\.edelweissfin\.com\/page-sitemap\.xml/i.test(rawHtml)
    && !hasPublicJobListingSignal(rawHtml)
}

export const isKnownLegacyNoPublicJobRoute = (page = {}) =>
  Number(page?.status) === 200
  && isFirstPartyUrl(page?.url)
  && !hasPublicJobListingSignal(page?.html)
  && (
    hasOfficialHomepageSignal(page?.html)
    || /join us for a session/i.test(extractTitle(page?.html))
  )

export const createEdelweissScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(ROOT_URL)
    if (homepage.status !== 200 || homepage.url !== ROOT_URL || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Edelweiss verified homepage no longer matches the trusted first-party surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (
      careersPage.status !== 200
      || careersPage.url !== CAREERS_URL
      || !hasVerifiedInformationalCareersSignal(careersPage.html)
    ) {
      throw new Error('Edelweiss verified informational careers page no longer matches the trusted first-party surface')
    }

    const robotsPage = await fetchPage(ROBOTS_URL)
    if (!hasMissingRobotsSignal(robotsPage)) {
      throw new Error('Edelweiss verified robots.txt route no longer matches the trusted first-party no-public-jobs surface')
    }

    const sitemapPage = await fetchPage(SITEMAP_URL)
    if (!hasVerifiedSitemapSignal(sitemapPage)) {
      throw new Error('Edelweiss verified sitemap route no longer matches the trusted first-party no-public-jobs surface')
    }

    for (const url of VERIFIED_ROUTE_URLS.slice(4)) {
      const page = await fetchPage(url)

      if (!isKnownLegacyNoPublicJobRoute(page)) {
        throw new Error(`Edelweiss legacy career-like route changed materially: ${url}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createEdelweissScraper().run(options)

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
