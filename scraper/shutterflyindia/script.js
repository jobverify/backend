import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { SHUTTERFLY_INDIA_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const OVERVIEW_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_ENTRY_URL = PROVIDER_METADATA.companyCareerPage
export const SEARCH_RESULTS_URL = PROVIDER_METADATA.officialSearchResultsUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(20000),
  })

  return {
    status: response.status,
    url: response.url || url,
    html: await response.text(),
  }
}

export const hasOfficialOverviewSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Overview\s*\|\s*SHUTTERFLY\s*<\/title>/i.test(page)
    && /https:\/\/shutterflycareers\.ttcportals\.com\//i.test(page)
    && /https:\/\/jobs\.jobvite\.com\/shutterfly/i.test(page)
    && text.includes('Search our job openings to find a role')
}

export const hasOfficialCareersHomeSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Shutterfly Careers\s*<\/title>/i.test(page)
    && text.includes('Careers at Shutterfly')
    && text.includes('Where We Work')
    && text.includes('Durham, NC')
    && text.includes('Haifa, Israel')
    && text.includes('Winnipeg, MB Canada')
}

export const hasOfficialSearchResultsSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Job Search Results\s*<\/title>/i.test(page)
    && text.includes('Job Search Results')
    && text.includes('Showing 1-25 of')
    && text.includes('Country')
    && text.includes('Canada')
    && text.includes('United States')
}

export const hasIndiaJobsSignal = (html = '') => {
  const text = normalizeWhitespace(html)

  return /\bIndia\b/i.test(text)
    || /\bBengaluru\b/i.test(text)
    || /\bBangalore\b/i.test(text)
    || /\bHyderabad\b/i.test(text)
    || /\bPune\b/i.test(text)
    || /\bMumbai\b/i.test(text)
    || /\bNoida\b/i.test(text)
    || /\bChennai\b/i.test(text)
    || /\bGurugram\b/i.test(text)
}

export const hasVerifiedCloudflareChallengeSignal = (page = {}) => {
  const html = String(page?.html ?? '')
  const text = normalizeWhitespace(html)
  const url = String(page?.url ?? '')

  return Number(page?.status) === 403
    && /<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(html)
    && text.includes('Enable JavaScript and cookies to continue')
    && /shutterflycareers\.ttcportals\.com/i.test(url)
}

export const createShutterflyIndiaScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchPage = defaultFetchPage,
  } = {}) {
    const overviewHtml = await fetchText(OVERVIEW_URL)
    if (hasIndiaJobsSignal(overviewHtml)) {
      throw new Error('Shutterfly India surface now appears to expose public India jobs')
    }
    if (!hasOfficialOverviewSignal(overviewHtml)) {
      throw new Error('Shutterfly India verified official overview page no longer matches the trusted first-party surface')
    }

    const careersEntryPage = await fetchPage(CAREERS_ENTRY_URL)
    if (hasIndiaJobsSignal(careersEntryPage.html)) {
      throw new Error('Shutterfly India surface now appears to expose public India jobs')
    }
    if (
      !hasVerifiedCloudflareChallengeSignal(careersEntryPage)
      && !hasOfficialCareersHomeSignal(careersEntryPage.html)
    ) {
      throw new Error('Shutterfly India verified careers entry page no longer matches the trusted first-party or challenge surface')
    }

    const searchResultsPage = await fetchPage(SEARCH_RESULTS_URL)
    if (hasIndiaJobsSignal(searchResultsPage.html)) {
      throw new Error('Shutterfly India surface now appears to expose public India jobs')
    }
    if (
      !hasVerifiedCloudflareChallengeSignal(searchResultsPage)
      && !hasOfficialSearchResultsSignal(searchResultsPage.html)
    ) {
      throw new Error('Shutterfly India verified search results page no longer matches the trusted first-party or challenge surface')
    }

    return []
  },
})

export const run = async (options = {}) => createShutterflyIndiaScraper().run(options)

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
