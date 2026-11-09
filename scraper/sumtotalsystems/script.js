import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { SUMTOTAL_SYSTEMS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SUMTOTAL_SYSTEMS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const ABOUT_URL = PROVIDER_METADATA.companyCareerPage
export const REDIRECT_HOMEPAGE_URL = PROVIDER_METADATA.redirectHomepageUrl
export const REDIRECT_COMPANY_URL = PROVIDER_METADATA.redirectCompanyUrl
export const PARENT_CAREERS_URL = PROVIDER_METADATA.parentCareersUrl
export const PARENT_OPEN_POSITIONS_URL = PROVIDER_METADATA.parentOpenPositionsUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const FETCH_TIMEOUT_MS = 15000

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
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
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasRedirectedHomepageSignal = (page = {}) => {
  const normalized = normalizeWhitespace(page?.html)

  return page?.status === 200
    && page?.url === REDIRECT_HOMEPAGE_URL
    && normalized.includes('Cornerstone Workforce AI')
    && (
      normalized.includes('The intelligence era of talent is coming to a city near you')
      || normalized.includes('Trusted by over 7,000 organizations worldwide')
    )
}

export const hasRedirectedCompanySignal = (page = {}) => {
  const rawHtml = String(page?.html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return page?.status === 200
    && page?.url === REDIRECT_COMPANY_URL
    && normalized.includes('We power potential')
    && (/href=["']https:\/\/www\.cornerstoneondemand\.com\/careers\/["']/i.test(rawHtml)
      || /href=["']\/careers\/["']/i.test(rawHtml))
    && normalized.includes('Explore Open Positions')
}

export const extractParentOpenPositionsUrl = (html = '') => {
  for (const match of String(html ?? '').matchAll(
    /<a[^>]+href=["']([^"']+)["'][^>]*>\s*Search Open Positions\s*<\/a>/gi,
  )) {
    try {
      return new URL(match[1], PARENT_CAREERS_URL).toString()
    } catch {
      continue
    }
  }

  return null
}

export const hasGenericCornerstoneCareersSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Careers at Cornerstone(?:\s*\|[\s\S]*?)?\s*<\/title>/i.test(rawHtml)
    && normalized.includes('Tomorrow. Together.')
    && normalized.includes('Interested in a Career at Cornerstone?')
    && normalized.includes('careers@csod.com')
    && normalized.includes('Search Open Positions')
    && extractParentOpenPositionsUrl(rawHtml) === PARENT_OPEN_POSITIONS_URL
}

export const createSumTotalSystemsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (!hasRedirectedHomepageSignal(homepage)) {
      throw new Error('The verified SumTotal Systems root redirect no longer matches the generic Cornerstone surface')
    }

    const aboutPage = await fetchPage(ABOUT_URL)
    if (!hasRedirectedCompanySignal(aboutPage)) {
      throw new Error('The verified SumTotal Systems about redirect no longer matches the generic Cornerstone surface')
    }

    const parentCareersPage = await fetchPage(PARENT_CAREERS_URL)
    if (
      parentCareersPage?.status !== 200
      || parentCareersPage?.url !== PARENT_CAREERS_URL
      || !hasGenericCornerstoneCareersSignal(parentCareersPage.html)
    ) {
      throw new Error('The generic Cornerstone careers surface no longer matches the verified SumTotal Systems sentinel')
    }

    return []
  },
})

export const run = async (options = {}) => createSumTotalSystemsScraper().run(options)

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
