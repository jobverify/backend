import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  BASE_URL,
  DEFAULT_PAGE_SIZE,
  extractPaginationSummary,
  extractSearchResults,
} from '../amazon/script.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { AMAZON_PAY_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = AMAZON_PAY_CATALOG.source
export const COMPANY = AMAZON_PAY_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = AMAZON_PAY_CATALOG.officialBrandName
export const VERIFIED_ON = AMAZON_PAY_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = AMAZON_PAY_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = AMAZON_PAY_CATALOG
export const SEARCH_QUERY = 'Amazon Pay'
export const SEARCH_COUNTRY_CODE = 'IND'
export const SEARCH_PAGE_URL = AMAZON_PAY_CATALOG.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const SEARCH_PAGE_SIGNAL_PATTERNS = [
  /<title>\s*Job search\s*\|\s*Amazon\.jobs\s*<\/title>/i,
  /property=["']og:url["'][^>]+content=["']https:\/\/www\.amazon\.jobs\/en\/search\?base_query=Amazon(?:%20|\+)Pay(?:&amp;|&)normalized_country_code%5B%5D=IND["']/i,
  /job_posting_search_request/i,
  /Amazon Pay/i,
  /normalizedCountryCode/i,
  /IND/i,
]

const AMAZON_PAY_SIGNAL_PATTERN = /\bamazon\s*pay\b|\bamazon-payments?\b/i

const encodeQueryValue = (value) => encodeURIComponent(String(value ?? ''))

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

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

const getAmazonPaySignalText = (record = {}) => [
  record.title,
  record.company_name,
  record.description_short,
  record.description,
  record.job_path,
  record.primary_search_label,
  record.team?.label,
  ...(Array.isArray(record.optional_search_labels) ? record.optional_search_labels : []),
].filter(Boolean).join(' ')

export const buildSearchPageUrl = () =>
  `${BASE_URL}/en/search?base_query=${encodeQueryValue(SEARCH_QUERY)}&normalized_country_code%5B%5D=${encodeQueryValue(SEARCH_COUNTRY_CODE)}`

export const buildSearchApiUrl = ({
  offset = 0,
  resultLimit = DEFAULT_PAGE_SIZE,
  sort = 'relevant',
} = {}) =>
  `${BASE_URL}/en/search.json?offset=${encodeQueryValue(Math.max(0, Number(offset) || 0))}&result_limit=${encodeQueryValue(Math.max(1, Number(resultLimit) || DEFAULT_PAGE_SIZE))}&sort=${encodeQueryValue(sort || 'relevant')}&base_query=${encodeQueryValue(SEARCH_QUERY)}&normalized_country_code%5B%5D=${encodeQueryValue(SEARCH_COUNTRY_CODE)}`

export const hasVerifiedSearchPageSignal = (html) => {
  const page = String(html ?? '')
  return SEARCH_PAGE_SIGNAL_PATTERNS.every((pattern) => pattern.test(page))
}

export const hasAmazonPaySignal = (record = {}) =>
  AMAZON_PAY_SIGNAL_PATTERN.test(getAmazonPaySignalText(record))

export const extractAmazonPayResults = (payload) => {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : []
  const matchingRecords = jobs.filter(hasAmazonPaySignal)

  return extractSearchResults({
    ...payload,
    jobs: matchingRecords,
  }).map((job) => ({
    ...job,
    company: COMPANY,
  }))
}

export const createAmazonPayScraper = ({
  pageSize = Number.isInteger(config.pageSize) ? config.pageSize : DEFAULT_PAGE_SIZE,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
    now: overrideNow,
  } = {}) {
    const searchPage = await fetchPage(SEARCH_PAGE_URL)

    if (Number(searchPage?.status) !== 200 || !hasVerifiedSearchPageSignal(searchPage?.html)) {
      throw new Error('Amazon Pay verified Amazon Jobs search page no longer matches the pinned public surface')
    }

    const jobs = []
    const seenJobIds = new Set()

    for (let page = 0; page < maxPages; page += 1) {
      const offset = page * pageSize
      const requestUrl = buildSearchApiUrl({ offset, resultLimit: pageSize })
      const payload = await fetchJson(requestUrl)
      const rawResults = Array.isArray(payload?.jobs) ? payload.jobs : []
      const listings = extractAmazonPayResults(payload)
      const summary = extractPaginationSummary(payload, { offset, resultLimit: pageSize })

      if (page === 0 && listings.length === 0) {
        throw new Error('Amazon Pay verified Amazon Jobs search JSON no longer exposes Amazon Pay search results')
      }

      for (const job of listings) {
        if (seenJobIds.has(job.jobId)) continue
        seenJobIds.add(job.jobId)

        jobs.push({
          ...job,
          source: SOURCE,
          companyCareerPage: SEARCH_PAGE_URL,
          companyDomain: PROVIDER_METADATA.companyDomain,
          atsPlatform: PROVIDER_METADATA.atsPlatform,
          link: job.applyUrl || job.sourceUrl,
          scrapedAt: (overrideNow || now)(),
        })

        if (maxJobs && jobs.length >= maxJobs) {
          return jobs
        }
      }

      if (!summary.hasNext || rawResults.length === 0) {
        break
      }
    }

    return jobs
  },
})

export const run = async (options = {}) => createAmazonPayScraper().run(options)

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
