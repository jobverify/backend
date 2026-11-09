import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { FASTRACK_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = FASTRACK_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.officialHomepageUrl
export const CAREERS_HANDOFF_URL = PROVIDER_METADATA.officialCareersHandoffUrl
export const CAREERS_HOME_URL = PROVIDER_METADATA.officialCareersHomeUrl
export const TITAN_CORPORATE_CAREERS_URL = PROVIDER_METADATA.titanCorporateCareersUrl
export const SEARCH_RESULTS_URL = PROVIDER_METADATA.officialSearchResultsUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#(?:x[aA]0|160);/gi, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeUrl = (value) => {
  try {
    const parsed = new URL(String(value ?? ''))
    const pathname = parsed.pathname.replace(/\/+$/, '') || '/'
    return `${parsed.origin}${pathname}${parsed.search}`
  } catch {
    return String(value ?? '').replace(/\/+$/, '')
  }
}

const getFinalUrl = (page, fallbackUrl) => page?.url || page?.finalUrl || fallbackUrl

const toAbsoluteUrl = (value, baseUrl) => {
  try {
    return new URL(String(value ?? ''), baseUrl).toString()
  } catch {
    return null
  }
}

const extractAnchorUrls = (html, baseUrl) => [...String(html ?? '').matchAll(/<a\b[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
  .map((match) => ({
    url: toAbsoluteUrl(match[1], baseUrl),
    text: normalizeWhitespace(match[2].replace(/<[^>]+>/g, ' ')),
  }))
  .filter((entry) => entry.url)

export const hasOfficialHomepageSignal = (page = {}) => {
  const html = String(page?.html ?? '')
  const normalized = normalizeWhitespace(html)

  return Number(page?.status) === 200
    && normalizeUrl(getFinalUrl(page, HOMEPAGE_URL)) === normalizeUrl(HOMEPAGE_URL)
    && /<title[^>]*>\s*Fastrack\s*-\s*Shop Fashion Accessories For Men,\s*Women\s*&\s*Kids\s*<\/title>/i.test(html)
    && normalized.includes('ABOUT FASTRACK')
    && normalized.includes('FASTRACK CATEGORIES')
  }

export const hasBlockedHomepageSignal = (page = {}) => {
  const html = String(page?.html ?? '')
  const normalized = normalizeWhitespace(html)

  return Number(page?.status) === 403
    && normalizeUrl(getFinalUrl(page, HOMEPAGE_URL)) === normalizeUrl(HOMEPAGE_URL)
    && /<title[^>]*>\s*Attention Required!\s*\|\s*Cloudflare\s*<\/title>/i.test(html)
    && normalized.includes('Please enable cookies.')
    && normalized.includes('You are unable to access fastrack.in')
}

export const extractCareersHandoffUrl = (html = '') => extractAnchorUrls(html, HOMEPAGE_URL)
  .find((entry) => entry.text === 'Careers')
  ?.url || null

export const hasTitanCorporateCareersSignal = (page = {}) => {
  const html = String(page?.html ?? '')
  const normalized = normalizeWhitespace(html)

  return Number(page?.status) === 200
    && normalizeUrl(getFinalUrl(page, TITAN_CORPORATE_CAREERS_URL))
      === normalizeUrl(TITAN_CORPORATE_CAREERS_URL)
    && /<title[^>]*>\s*Career Opportunities at Titan Company\s*<\/title>/i.test(html)
    && normalized.includes('Current vacancies')
    && normalized.includes('Life at Titan')
    && normalized.includes('Working at Titan Company Limited')
    && /brands like[\s\S]*Fastrack/i.test(html)
  }

export const extractCurrentVacanciesUrl = (html = '') => extractAnchorUrls(html, TITAN_CORPORATE_CAREERS_URL)
  .find((entry) => entry.text === 'Current vacancies')
  ?.url || null

export const hasTitanJobsHomeSignal = (page = {}) => {
  const html = String(page?.html ?? '')
  const normalized = normalizeWhitespace(html)

  return Number(page?.status) === 200
    && normalizeUrl(getFinalUrl(page, CAREERS_HANDOFF_URL)) === normalizeUrl(CAREERS_HOME_URL)
    && /<title[^>]*>\s*Careers at Titan\s*\|\s*Titan jobs\s*<\/title>/i.test(html)
    && (normalized.includes('DREAM. DISCOVER. DESIGN')
      || normalized.includes('What is it like to work with Titan?'))
    && normalized.includes('Career Paths')
    && normalized.includes('Upload Resume')
    && normalized.includes('Our Brands')
    && normalized.includes('Search results')
  }

export const hasZeroJobsSignal = (page = {}) => {
  const html = String(page?.html ?? '')
  const normalized = normalizeWhitespace(html)

  return Number(page?.status) === 200
    && normalizeUrl(getFinalUrl(page, SEARCH_RESULTS_URL)) === normalizeUrl(SEARCH_RESULTS_URL)
    && /<title[^>]*>\s*Search results\s*\|\s*Find available job openings at Titan\s*<\/title>/i.test(html)
    && normalized.includes('SEARCH RESULTS')
    && /We couldn[’']t find any open positions for/i.test(normalized)
    && normalized.includes('Sorry... no active job openings, please come back later.')
  }

export const hasPublicJobSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return /\/in\/en\/job\//i.test(html)
    || /Displaying\s+\d+\s+to\s+\d+\s+of\s+\d+/i.test(normalized)
    || /View Job/i.test(normalized)
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

export const createFastrackScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepagePage = await fetchPage(HOMEPAGE_URL)
    const hasHomepageSignal = hasOfficialHomepageSignal(homepagePage)
    const hasHomepageBlockSignal = hasBlockedHomepageSignal(homepagePage)

    if (!hasHomepageSignal && !hasHomepageBlockSignal) {
      throw new Error('Fastrack homepage no longer matches the verified official first-party surface')
    }

    if (hasHomepageSignal && extractCareersHandoffUrl(homepagePage.html) !== CAREERS_HANDOFF_URL) {
      throw new Error('Fastrack homepage no longer links to the verified careers handoff')
    }

    const titanCorporateCareersPage = await fetchPage(TITAN_CORPORATE_CAREERS_URL)
    if (!hasTitanCorporateCareersSignal(titanCorporateCareersPage)) {
      throw new Error('Fastrack parent corporate careers page no longer matches the verified public surface')
    }

    if (extractCurrentVacanciesUrl(titanCorporateCareersPage.html) !== SEARCH_RESULTS_URL) {
      throw new Error('Fastrack parent careers page no longer links to the verified current vacancies surface')
    }

    const careersHomePage = await fetchPage(CAREERS_HANDOFF_URL)
    if (!hasTitanJobsHomeSignal(careersHomePage)) {
      throw new Error('Fastrack verified parent careers home no longer matches the public handoff surface')
    }

    const searchResultsPage = await fetchPage(SEARCH_RESULTS_URL)
    if (hasZeroJobsSignal(searchResultsPage)) {
      return []
    }

    if (hasPublicJobSignal(searchResultsPage.html)) {
      throw new Error('Fastrack public jobs surface now exposes openings')
    }

    throw new Error('Fastrack zero-openings search shell no longer matches the verified public surface')
  },
})

export const run = async (options = {}) => createFastrackScraper().run(options)

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
