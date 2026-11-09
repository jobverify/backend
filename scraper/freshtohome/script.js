import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { FRESHTOHOME_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = FRESHTOHOME_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const ROBOTS_TXT_URL = PROVIDER_METADATA.robotsTxtUrl
export const SITEMAP_URL = PROVIDER_METADATA.sitemapUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const CAREERS_ROUTE_URLS = [...PROVIDER_METADATA.checkedMissingRouteUrls]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /successfactors/i,
  /oraclecloud/i,
  /darwinbox/i,
  /icims/i,
  /taleo/i,
  /peoplestrong/i,
]

const CAREER_PATH_PATTERN = /(?:^|\/)(career|careers|job|jobs|opening|openings|vacancy|vacancies|hiring|join-us|joinus|work-with-us|current-openings)(?:\/|$)/i
const ATS_HOST_PATTERN = /(^|\.)(ashbyhq\.com|greenhouse\.io|lever\.co|myworkdayjobs\.com|smartrecruiters\.com|freshteam\.com|workable\.com|darwinbox\.in|keka\.com|zohorecruit\.com)$/i

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

const stripScriptAndStyle = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, HOMEPAGE_URL)
  } catch {
    return null
  }
}

const isCareerLikeUrl = (url) => {
  if (!url || !/^https?:$/i.test(url.protocol)) return false
  return CAREER_PATH_PATTERN.test(url.pathname) || ATS_HOST_PATTERN.test(url.hostname)
}

const isOfficialDomainUrl = (value) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === 'www.freshtohome.com' || hostname === 'freshtohome.com'
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

export const hasFirstPartyCareerLikeLink = (html = '') => {
  const rawHtml = stripScriptAndStyle(html)

  for (const match of rawHtml.matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1])
    if (absoluteUrl && isOfficialDomainUrl(absoluteUrl.toString()) && isCareerLikeUrl(absoluteUrl)) {
      return true
    }
  }

  return false
}

export const hasOfficialHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  return /<title>\s*FreshToHome - Order Fresh Fish, Chicken and Mutton Online\.\s*<\/title>/i.test(rawHtml)
    && /customercare@freshtohome\.com/i.test(rawHtml)
    && /Certificates/i.test(rawHtml)
    && normalized.includes('fish & seafood')
    && /Poultry/i.test(rawHtml)
    && /Mutton/i.test(rawHtml)
}

export const hasExpectedRobotsTxtSignal = (text = '') => {
  const normalized = String(text ?? '')

  return /User-agent:\s*\*/i.test(normalized)
    && /Sitemap:\s*https:\/\/www\.freshtohome\.com\/sitemap\/sitemap\.xml/i.test(normalized)
    && /Sitemap:\s*https:\/\/www\.freshtohome\.com\/blog\/sitemap_index\.xml/i.test(normalized)
    && /Disallow:\s*\/admin\//i.test(normalized)
}

export const extractCareerLikeUrlsFromSitemap = (xml = '') =>
  [...String(xml ?? '').matchAll(/<loc>(.*?)<\/loc>/gi)]
    .map((match) => match[1])
    .filter((url) => /\/(?:career|careers|jobs?|join-us|work-with-us|openings|current-openings)(?:$|[/?#])/i.test(url))

export const isMissingCareerRoute = (page = {}) =>
  Number(page.status) === 404
  && isOfficialDomainUrl(page.url || '')
  && /<title>\s*404 Not Found\s*<\/title>/i.test(String(page.html ?? ''))
  && /The page you wanted to visit could not be found\./i.test(String(page.html ?? ''))
  && !hasPublicJobsSignal(page.html)

export const createFreshToHomeScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('FreshToHome verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('FreshToHome homepage now appears to expose public jobs')
    }

    if (hasFirstPartyCareerLikeLink(homepage.html)) {
      throw new Error('FreshToHome homepage now exposes a first-party careers or jobs link')
    }

    const robotsTxt = await fetchPage(ROBOTS_TXT_URL)
    if (robotsTxt.status !== 200 || !hasExpectedRobotsTxtSignal(robotsTxt.html)) {
      throw new Error('FreshToHome verified robots.txt no longer matches the known public surface')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (sitemap.status !== 200 || extractCareerLikeUrlsFromSitemap(sitemap.html).length > 0) {
      throw new Error('FreshToHome verified sitemap no longer matches the known public surface')
    }

    for (const routeUrl of CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (!isMissingCareerRoute(routePage)) {
        throw new Error(`FreshToHome verified no-public-careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createFreshToHomeScraper().run(options)

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
