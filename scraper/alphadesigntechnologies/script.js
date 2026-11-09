import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ALPHA_DESIGN_TECHNOLOGIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = ALPHA_DESIGN_TECHNOLOGIES_CATALOG.source
export const COMPANY = ALPHA_DESIGN_TECHNOLOGIES_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = ALPHA_DESIGN_TECHNOLOGIES_CATALOG.officialBrandName
export const VERIFIED_ON = ALPHA_DESIGN_TECHNOLOGIES_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = ALPHA_DESIGN_TECHNOLOGIES_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = ALPHA_DESIGN_TECHNOLOGIES_CATALOG
export const HOMEPAGE_URL = ALPHA_DESIGN_TECHNOLOGIES_CATALOG.homepageUrl
export const CAREERS_URL = ALPHA_DESIGN_TECHNOLOGIES_CATALOG.companyCareerPage
export const APPLICATION_EMAIL = ALPHA_DESIGN_TECHNOLOGIES_CATALOG.applicationEmail
export const APPLICATION_URL = ALPHA_DESIGN_TECHNOLOGIES_CATALOG.applicationUrl
export const NO_PUBLIC_CAREER_ROUTE_URLS = [
  'https://www.adtl.co.in/career',
  'https://www.adtl.co.in/jobs',
  'https://www.adtl.co.in/join-us',
  'https://www.adtl.co.in/openings',
  'https://www.adtl.co.in/work-with-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bjob description\b/i,
  /\bapply now\b/i,
  /\bview opportunity\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /href=["'][^"']*\/jobs\/[^"']*["']/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
]

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    ok: response.ok,
    status: response.status,
    url: response.url,
    text: await response.text(),
  }
}

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

const isOfficialDomainUrl = (value) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === 'www.adtl.co.in' || hostname === 'adtl.co.in'
  } catch {
    return false
  }
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Home\s*<\/title>/i.test(page)
    && normalized.includes('Alpha Design Technologies Pvt Ltd.')
    && /"\s*MAKE IN INDIA\s*"\s*policy of the Government of India\./i.test(normalized)
    && normalized.includes('Established in Bangalore during 2004')
    && normalized.includes('About Alpha')
    && normalized.includes('Careers')
    && normalized.includes('contact@adtl.co.in')
    && normalized.includes('ALPHA DESIGN TECHNOLOGIES PVT LTD')
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Careers\s*\|\s*adtl\s*<\/title>/i.test(page)
    && normalized.includes('At Alpha Design Technologies, we are dedicated to building a team that reflects the diversity and talent of our communities.')
    && normalized.includes('To apply for any of the positions, please submit your resume to careers@adtl.co.in')
    && /mailto:careers@adtl\.co\.in/i.test(page)
    && normalized.includes('career-detail')
    && normalized.includes('contact@adtl.co.in')
    && normalized.includes('ALPHA DESIGN TECHNOLOGIES PVT LTD')
}

export const pageExposesPublicJobListings = (html = '') =>
  PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedMissingCareerRoute = (page = {}) => {
  const html = String(page.text ?? page.html ?? '')
  const normalized = normalizeWhitespace(html)

  const legacyMissingPage = Number(page.status) === 404
    && /<title>\s*404 - File or directory not found\.\s*<\/title>/i.test(html)
    && normalized.includes('404 - File or directory not found.')
    && normalized.includes('The resource you are looking for might have been removed, had its name changed, or is temporarily unavailable.')
  const customMissingPage = Number(page.status) === 200
    && /\/404error\/?(?:[?#]|$)/i.test(page.url || '')
    && /<title>\s*404 Error Page\s*<\/title>/i.test(html)
    && normalized.includes("We couldn't find the page")
    && normalized.includes('Go Back to Home Page')
  return isOfficialDomainUrl(page.url || '')
    && (legacyMissingPage || customMissingPage)
    && !pageExposesPublicJobListings(html)
  }

export const createAlphaDesignTechnologiesScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (!homepage.ok || !hasOfficialHomepageSignal(homepage.text)) {
      throw new Error('The official Alpha Design Technologies homepage no longer matches the verified public surface')
    }

    if (pageExposesPublicJobListings(homepage.text)) {
      throw new Error('The official Alpha Design Technologies homepage appears to expose public job listings')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (!careersPage.ok || !hasOfficialCareersSignal(careersPage.text)) {
      throw new Error('The official Alpha Design Technologies careers page no longer matches the verified resume-only surface')
    }

    if (pageExposesPublicJobListings(careersPage.text)) {
      throw new Error('The official Alpha Design Technologies careers page appears to expose public job listings')
    }

    for (const routeUrl of NO_PUBLIC_CAREER_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingCareerRoute(routePage)) {
        throw new Error(`Alpha Design Technologies verified no-public-careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createAlphaDesignTechnologiesScraper().run(options)

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
