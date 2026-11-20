import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { PAYU_CATALOG } from './catalog.js'
import {fetchReviewedPayUPage,isCurrentPayUSurface,runCurrentPayU} from './currentNative20261116.js'
import {runPayUPublications} from './currentPublished20261119.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = PAYU_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const GLOBAL_JOB_BOARD_URL = PROVIDER_METADATA.globalJobBoardUrl
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&#8217;|&rsquo;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtml(String(value ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, '')
    }
    return url.toString()
  } catch {
    return String(value ?? '')
  }
}

const defaultFetchPage = fetchReviewedPayUPage

export const hasOfficialCareersSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const text = normalizeWhitespace(rawHtml)

  return text.includes('Be a PayUneer')
    && text.includes('Life at PayU India')
    && text.includes('Who do we hire? We hire the right tribe')
    && text.includes('View all open positions')
    && /https:\/\/corporate\.payu\.com\/job-board\//i.test(rawHtml)
}

export const hasOfficialJobBoardSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const text = normalizeWhitespace(rawHtml)

  return text.includes('Become a PayUneer')
    && /Showing\s+\d+\s+of\s+\d+\s+positions/i.test(text)
    && text.includes('Czech Republic')
    && text.includes('Poland')
    && text.includes('Romania')
}

export const extractVisibleJobLocations = (html = '') => {
  const locations = new Set()
  const rawHtml = String(html ?? '')

  for (const match of rawHtml.matchAll(/data-type=["']location["'][^>]*>([^<]+)</gi)) {
    const normalized = normalizeWhitespace(match[1])
    if (normalized) {
      locations.add(normalized)
    }
  }

  return [...locations]
}

export const jobBoardHasIndiaLocations = (html = '') =>
  extractVisibleJobLocations(html).some((location) => /\bindia\b/i.test(location))

const createLegacyPayUScraper = () => ({
  async run({ fetchPage = defaultFetchPage, signal, now } = {}) {
    signal?.throwIfAborted()
    const read = async (url) => {
      signal?.throwIfAborted()
      try {
        const page = await fetchPage(url,{signal})
        signal?.throwIfAborted()
        return page
      } catch (error) {
        signal?.throwIfAborted()
        throw error
      }
    }
    const careersPage = await read(CAREERS_URL)
    signal?.throwIfAborted()
    if(isCurrentPayUSurface(careersPage))return runCurrentPayU({initialPage:careersPage,fetchPage,signal,now})

    if (
      careersPage.status !== 200
      || normalizeComparableUrl(careersPage.url) !== normalizeComparableUrl(CAREERS_URL)
      || !hasOfficialCareersSignal(careersPage.html)
    ) {
      throw new Error('PayU careers page no longer matches the verified India careers handoff surface')
    }

    const jobBoardPage = await read(GLOBAL_JOB_BOARD_URL)
    signal?.throwIfAborted()

    if (
      jobBoardPage.status !== 200
      || normalizeComparableUrl(jobBoardPage.url) !== normalizeComparableUrl(GLOBAL_JOB_BOARD_URL)
      || !hasOfficialJobBoardSignal(jobBoardPage.html)
    ) {
      throw new Error('PayU global job board no longer matches the verified public board surface')
    }

    const locations = extractVisibleJobLocations(jobBoardPage.html)
    if (locations.length === 0) {
      throw new Error('PayU global job board no longer exposes parsable public job locations')
    }

    if (jobBoardHasIndiaLocations(jobBoardPage.html)) {
      throw new Error('PayU global job board now exposes India roles')
    }

    signal?.throwIfAborted()
    return []
  },
})

// Keep the explicit legacy fixture interface available to its existing callers;
// ordinary production and Response callbacks use the current native reader.
export const createPayUScraper = () => ({run: (options = {}) => options.fetchPage
  ? createLegacyPayUScraper().run(options) : runPayUPublications(options)})
export const run = async (options = {}) => createPayUScraper().run(options)

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
