import path from 'node:path'
import { fileURLToPath } from 'node:url'

import MOSCHIP_TECHNOLOGIES_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = MOSCHIP_TECHNOLOGIES_CATALOG
export const SOURCE = MOSCHIP_TECHNOLOGIES_CATALOG.source
export const COMPANY = MOSCHIP_TECHNOLOGIES_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = MOSCHIP_TECHNOLOGIES_CATALOG.officialBrandName
export const VERIFIED_ON = MOSCHIP_TECHNOLOGIES_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = MOSCHIP_TECHNOLOGIES_CATALOG.verifiedSurfaceSummary
export const HOMEPAGE_URL = MOSCHIP_TECHNOLOGIES_CATALOG.homepageUrl
export const CAREERS_URL = MOSCHIP_TECHNOLOGIES_CATALOG.companyCareerPage
export const CURRENT_OPENINGS_URL = MOSCHIP_TECHNOLOGIES_CATALOG.currentOpeningsUrl
export const EMPTY_JOB_ARCHIVE_URL = MOSCHIP_TECHNOLOGIES_CATALOG.emptyJobArchiveUrl
export const APPLICATION_EMAIL = MOSCHIP_TECHNOLOGIES_CATALOG.applicationEmail
export const APPLICATION_URL = MOSCHIP_TECHNOLOGIES_CATALOG.applicationUrl
export const NO_PUBLIC_CAREER_ROUTE_URLS = MOSCHIP_TECHNOLOGIES_CATALOG.noPublicCareerRouteUrls

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
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

const toAbsoluteUrl = (value, baseUrl) => {
  try {
    return new URL(String(value ?? ''), baseUrl).toString()
  } catch {
    return null
  }
}

export const pageExposesPublicJobListings = (html = '') => [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bapply now\b/i,
  /\bview jobs\b/i,
  /\bjob vacancy\b/i,
  /boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /darwinbox/i,
  /icims/i,
  /taleo/i,
  /jobdetails/i,
].some((pattern) => pattern.test(String(html ?? '')))

export const extractCurrentOpeningsUrl = (html = '') => {
  for (const match of String(html ?? '').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = normalizeWhitespace(match[2])
    if (label !== 'Current Openings') continue
    return toAbsoluteUrl(match[1], CAREERS_URL)
  }

  return null
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Careers - MosChip\s*<\/title>/i.test(page)
    && /Grow with us\. Join now\./i.test(normalized)
    && /Innovation Leaders/i.test(normalized)
}

export const hasCurrentOpeningsNoListingSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Current Job Openings\s*\|\s*MosChip\s*<\/title>/i.test(page)
    && /Drop your CV/i.test(normalized)
    && /Find Current Openings on/i.test(normalized)
    && /LinkedIn/i.test(normalized)
    && /careers@moschip\.com/i.test(page)
    && /suitable job opens/i.test(normalized)
    && /Submit Your Resume/i.test(normalized)
    && !pageExposesPublicJobListings(page)
}

export const isVerifiedMissingRoute = ({ status, html } = {}) =>
  Number(status) === 404
  && /<title>\s*Page not found - MosChip\s*<\/title>/i.test(String(html ?? ''))
  && !pageExposesPublicJobListings(html)

export const createMosChipTechnologiesScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)
    if (
      Number(careersPage?.status) !== 200
      || normalizeComparableUrl(careersPage?.url) !== normalizeComparableUrl(CAREERS_URL)
      || !hasOfficialCareersPageSignal(careersPage?.html)
    ) {
      throw new Error('The verified MosChip careers page changed materially')
    }

    if (normalizeComparableUrl(extractCurrentOpeningsUrl(careersPage?.html)) !== normalizeComparableUrl(CURRENT_OPENINGS_URL)) {
      throw new Error('The verified MosChip careers handoff changed materially')
    }

    const currentOpeningsPage = await fetchPage(CURRENT_OPENINGS_URL)
    if (
      Number(currentOpeningsPage?.status) !== 200
      || normalizeComparableUrl(currentOpeningsPage?.url) !== normalizeComparableUrl(CURRENT_OPENINGS_URL)
    ) {
      throw new Error('The verified MosChip current-openings page changed materially')
    }

    if (pageExposesPublicJobListings(currentOpeningsPage?.html)) {
      throw new Error('MosChip current-openings page now appears to expose public job listings')
    }

    if (!hasCurrentOpeningsNoListingSignal(currentOpeningsPage?.html)) {
      throw new Error('The verified MosChip current-openings page changed materially')
    }

    for (const routeUrl of [EMPTY_JOB_ARCHIVE_URL, ...NO_PUBLIC_CAREER_ROUTE_URLS]) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingRoute(routePage)) {
        throw new Error(`The verified empty jobs route changed for MosChip Technologies: ${routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createMosChipTechnologiesScraper().run(options)

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
