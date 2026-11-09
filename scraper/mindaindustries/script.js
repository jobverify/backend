import { mapJobsWithInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createDarwinboxScraper } from '../darwinbox/script.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { MINDA_INDUSTRIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = MINDA_INDUSTRIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const OFFICIAL_CAREERS_HANDOFF_URL = PROVIDER_METADATA.officialCareersHandoffUrl
export const DARWINBOX_ORIGIN = PROVIDER_METADATA.darwinboxOrigin
export const DARWINBOX_COMPANY_ID = PROVIDER_METADATA.darwinboxCompanyId
export const PUBLIC_ALL_JOBS_URL = PROVIDER_METADATA.publicAllJobsUrl
export const PUBLIC_LISTING_API_URL = PROVIDER_METADATA.listingApiUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const DEFAULT_PAGE_SIZE = 10

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

export const extractApplicationContact = (html) =>
  normalizeWhitespace(String(html ?? '').match(/mailto:(corphr@unominda\.com)/i)?.[1] ?? null)

export const hasVerifiedCareersPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return normalized.includes('Join our talent community')
    && normalized.includes('Drop your resume at')
    && extractApplicationContact(rawHtml) === 'corphr@unominda.com'
    && rawHtml.includes(OFFICIAL_CAREERS_HANDOFF_URL)
}

export const buildMindaIndustriesListingApiUrl = (companyId = DARWINBOX_COMPANY_ID) =>
  `${DARWINBOX_ORIGIN}/ms/candidateapi/job/alljobs?companyId=${encodeURIComponent(companyId)}`

export const buildMindaIndustriesListingRequestBody = ({
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  companyId = DARWINBOX_COMPANY_ID,
} = {}) => ({
  companyId,
  sort_option: 'new',
  limit: pageSize,
  page,
})

const buildPublicAllJobsUrl = (companyId = DARWINBOX_COMPANY_ID) =>
  `${DARWINBOX_ORIGIN}/ms/candidatev2/${encodeURIComponent(companyId)}/careers/allJobs`

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'mindaindustries-html',
  timeoutMs: 15000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  ...options,
  label: 'mindaindustries-json',
  timeoutMs: 15000,
})

export const fetchMindaIndustriesListingPage = ({
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  companyId = DARWINBOX_COMPANY_ID,
  fetchJson = defaultFetchJson,
} = {}) => fetchJson(buildMindaIndustriesListingApiUrl(companyId), {
  method: 'POST',
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    'Content-Type': 'application/json',
    Origin: DARWINBOX_ORIGIN,
    Referer: buildPublicAllJobsUrl(companyId),
  },
  body: JSON.stringify(buildMindaIndustriesListingRequestBody({
    page,
    pageSize,
    companyId,
  })),
})

const createConfiguredDarwinboxScraper = () => createDarwinboxScraper({
  companyName: COMPANY_NAME,
  source: SOURCE,
  companyId: DARWINBOX_COMPANY_ID,
  origin: DARWINBOX_ORIGIN,
})

export const createMindaIndustriesScraper = ({
  now = () => new Date().toISOString(),
} = {}) => {
  const darwinboxScraper = createConfiguredDarwinboxScraper()

  return {
    ...darwinboxScraper,
    run: async ({
      fetchText = defaultFetchText,
      fetchJson,
      fetchListingPage,
      ...darwinboxOptions
    } = {}) => {
      const careersHtml = await fetchText(CAREERS_URL)
      if (!hasVerifiedCareersPageSignal(careersHtml)) {
        throw new Error('Minda Industries verified careers page no longer matches the trusted Uno Minda surface')
      }

      const listingFetcher = fetchListingPage || ((params) =>
        fetchMindaIndustriesListingPage({
          ...params,
          fetchJson,
        }))

      const jobs = await darwinboxScraper.run({
        ...darwinboxOptions,
        fetchListingPage: listingFetcher,
      })
      const scrapedAt = now()

      return mapJobsWithInventoryEvidence(jobs, (job) => ({
        ...job,
        scrapedAt,
      }))
    },
  }
}

const scraper = createMindaIndustriesScraper()

export const {
  buildCareersPageUrl,
  buildListingApiUrl,
  buildJobDetailUrl,
  extractSearchResults,
  run,
} = scraper

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
