import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ANANTA_ASPEN_CENTRE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = ANANTA_ASPEN_CENTRE_CATALOG.source
export const COMPANY = ANANTA_ASPEN_CENTRE_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = ANANTA_ASPEN_CENTRE_CATALOG.officialBrandName
export const VERIFIED_ON = ANANTA_ASPEN_CENTRE_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = ANANTA_ASPEN_CENTRE_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = ANANTA_ASPEN_CENTRE_CATALOG
export const HOMEPAGE_URL = ANANTA_ASPEN_CENTRE_CATALOG.homepageUrl
export const CAREERS_URL = ANANTA_ASPEN_CENTRE_CATALOG.careersPageUrl
export const LEGACY_CAREER_URL = ANANTA_ASPEN_CENTRE_CATALOG.legacyCareerUrl
export const NO_PUBLIC_JOB_ROUTE_URLS = ANANTA_ASPEN_CENTRE_CATALOG.noPublicJobRouteUrls

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bview details\b/i,
  /\bjob description\b/i,
  /\bjob[-\s]?card\b/i,
  /\bjob-listing-item\b/i,
  /data-job-id=/i,
  /\/careers\/[^"' >]+\/apply/i,
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value, baseUrl) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const isOfficialDomainUrl = (value) => {
  try {
    return new URL(value).hostname.toLowerCase() === 'anantacentre.in'
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

export const hasPublicJobBoardSignal = (html = '') =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Ananta Centre\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/anantacentre\.in\/["']/i.test(page)
    && extractCareerUrl(page) === CAREERS_URL
    && normalized.includes('Mission')
    && normalized.includes('Ananta Centre')
}

export const extractCareerUrl = (html = '') => {
  const rawHtml = String(html ?? '')

  for (const match of rawHtml.matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1], HOMEPAGE_URL)
    if (absoluteUrl === CAREERS_URL) {
      return absoluteUrl
    }
  }

  return null
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Careers\s*(?:&#8211;|&ndash;|–|-)\s*Ananta Centre\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/anantacentre\.in\/careers\/["']/i.test(page)
    && normalized.includes('CAREERS')
    && normalized.includes('Apply Now')
    && /data-elementor-id=["']41347["']/i.test(page)
    && normalized.includes('Are you applying for an internship?')
    && /<input\b[^>]*type=["']file["'][^>]*>/i.test(page)
    && normalized.includes('I hereby authorize Ananta Centre to use my email address and mobile number for the purpose of further communication.')
    && normalized.includes('SUBMIT')
}

export const isVerifiedCareerRedirectPage = (page = {}) =>
  Number(page.status) === 200
  && String(page.url ?? '') === CAREERS_URL
  && hasOfficialCareersPageSignal(page.html)
  && !hasPublicJobBoardSignal(page.html)

export const isVerifiedMissingPublicJobRoute = (page = {}) => {
  const html = String(page.html ?? '')
  const normalized = normalizeWhitespace(html)

  return Number(page.status) === 404
    && isOfficialDomainUrl(page.url || '')
    && /<title>\s*Page not found\s*(?:&#8211;|&ndash;|–|-)\s*Ananta Centre\s*<\/title>/i.test(html)
    && normalized.includes('Search')
    && normalized.includes('Ananta Centre')
    && !hasPublicJobBoardSignal(html)
}

export const createAnantaAspenCentreScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      homepage.status !== 200
      || !hasOfficialHomepageSignal(homepage.html)
      || extractCareerUrl(homepage.html) !== CAREERS_URL
    ) {
      throw new Error('Ananta Aspen Centre verified official homepage no longer matches the trusted first-party career handoff')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200) {
      throw new Error('Ananta Aspen Centre verified careers page no longer matches the trusted first-party nonlisting shell')
    }

    if (hasPublicJobBoardSignal(careersPage.html)) {
      throw new Error('Ananta Aspen Centre careers page now appears to expose a public jobs surface')
    }

    if (!hasOfficialCareersPageSignal(careersPage.html)) {
      throw new Error('Ananta Aspen Centre verified careers page no longer matches the trusted first-party nonlisting shell')
    }

    const legacyCareerPage = await fetchPage(LEGACY_CAREER_URL)
    if (!isVerifiedCareerRedirectPage(legacyCareerPage)) {
      throw new Error('Ananta Aspen Centre legacy career route no longer resolves to the trusted first-party careers page')
    }

    for (const routeUrl of NO_PUBLIC_JOB_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingPublicJobRoute(routePage)) {
        throw new Error(`Ananta Aspen Centre common job route changed materially or now exposes public jobs: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createAnantaAspenCentreScraper().run(options)

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
