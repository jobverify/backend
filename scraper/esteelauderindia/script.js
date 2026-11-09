import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ESTEE_LAUDER_INDIA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = ESTEE_LAUDER_INDIA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const SEARCH_JOBS_URL = PROVIDER_METADATA.searchJobsPage
export const EMPTY_CAREERS_ROUTE_DEFINITIONS = [
  {
    label: 'brand jobs',
    url: PROVIDER_METADATA.brandJobsPage,
    expectedTitle: 'Brands',
  },
  {
    label: 'corporate jobs',
    url: PROVIDER_METADATA.corporateJobsPage,
    expectedTitle: 'Corporate',
  },
  {
    label: 'retail jobs',
    url: PROVIDER_METADATA.retailJobsPage,
    expectedTitle: 'Retail',
  },
  {
    label: 'technology jobs',
    url: PROVIDER_METADATA.technologyJobsPage,
    expectedTitle: 'Technology',
  },
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#233;|&eacute;/gi, 'e')
  .replace(/&nbsp;/gi, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1] || '')
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

export const extractLocationConfig = (html = '') => {
  const rawHtml = String(html ?? '')
  const country = normalizeWhitespace(rawHtml.match(/<div id=["']JobCountry["']>([\s\S]*?)<\/div>/i)?.[1] || '')
  const city = normalizeWhitespace(rawHtml.match(/<div id=["']JobCity["']>([\s\S]*?)<\/div>/i)?.[1] || '')

  return {
    country: country || null,
    city: city || null,
  }
}

const hasExpectedTitle = (html = '', expectedTitle = '') => {
  const title = extractTitle(html)
  return title.startsWith(expectedTitle) && /Lauder Companies Inc\./i.test(title)
}

const hasEmptyJobsShell = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)
  const location = extractLocationConfig(rawHtml)

  return location.country === 'India'
    && Boolean(location.city)
    && /No jobs available\./i.test(normalized)
    && /Search all jobs:/i.test(normalized)
    && /id=["']job-search["']/i.test(rawHtml)
    && /id=["']location-search["']/i.test(rawHtml)
    && /id=["']search-button["']/i.test(rawHtml)
    && /search-with-eightfold/i.test(rawHtml)
    && /Latest Roles/i.test(normalized)
    && /See all/i.test(normalized)
}

export const hasPublicJobsSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /href=["'][^"']*\/careers\/job\/[^"']+["']/i.test(rawHtml)
    || /href=["'][^"']*(apply|jobdetails|job-detail|view-job)[^"']*["']/i.test(rawHtml)
    || /\bApply now\b/i.test(normalized)
}

export const hasVerifiedCareersHubSignal = (html = '') => {
  const rawHtml = String(html ?? '')

  return hasExpectedTitle(rawHtml, 'Careers')
    && /Browse open jobs by career area, brand or location\./i.test(rawHtml)
    && /href=["']\/en\/careers\/brand-jobs["']/i.test(rawHtml)
    && /href=["']\/en\/careers\/corporate-jobs["']/i.test(rawHtml)
    && /href=["']\/en\/careers\/retail-jobs["']/i.test(rawHtml)
    && /href=["']\/en\/careers\/technology-jobs["']/i.test(rawHtml)
    && hasEmptyJobsShell(rawHtml)
    && !hasPublicJobsSignal(rawHtml)
}

export const hasVerifiedEmptyCategoryPageSignal = (html = '', expectedTitle = '') =>
  hasExpectedTitle(html, expectedTitle)
  && hasEmptyJobsShell(html)
  && !hasPublicJobsSignal(html)

export const hasVerifiedMissingSearchRouteSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return hasExpectedTitle(rawHtml, 'Page Not Found')
    && /id=["']ip3-404-error["']/i.test(rawHtml)
    && /\bPage Not Found\b/i.test(normalized)
    && /\bPage not found\b/i.test(normalized)
}

export const createEsteeLauderIndiaScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const careersHubPage = await fetchPage(CAREERS_URL)
    if (careersHubPage.status !== 200 || !hasVerifiedCareersHubSignal(careersHubPage.html)) {
      throw new Error('Estee Lauder India verified official careers hub no longer matches the known first-party surface')
    }

    for (const route of EMPTY_CAREERS_ROUTE_DEFINITIONS) {
      const routePage = await fetchPage(route.url)

      if (routePage.status !== 200 || !hasVerifiedEmptyCategoryPageSignal(routePage.html, route.expectedTitle)) {
        throw new Error(`Estee Lauder India verified empty careers page changed: ${routePage.url || route.url}`)
      }
    }

    const searchJobsPage = await fetchPage(SEARCH_JOBS_URL)
    if (
      ![200, 404].includes(Number(searchJobsPage.status))
      || !hasVerifiedMissingSearchRouteSignal(searchJobsPage.html)
    ) {
      throw new Error(
        `Estee Lauder India verified missing search-jobs route changed: ${searchJobsPage.url || SEARCH_JOBS_URL}`,
      )
    }

    return []
  },
})

export const run = async (options = {}) => createEsteeLauderIndiaScraper().run(options)

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
