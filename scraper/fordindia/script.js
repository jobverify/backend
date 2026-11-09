import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  INDIA_FACET_ID as BASE_INDIA_FACET_ID,
  RESULTS_POST_URL as BASE_RESULTS_POST_URL,
  buildResultsRequestBody,
  buildSearchUrl,
  createFordMotorPvtLtdScraper,
  extractJobDetail,
  extractPaginationSummary,
  extractSearchResults,
} from '../fordmotorpvtltd/script.js'

import { FORD_INDIA_CATALOG } from './catalog.js'
import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = FORD_INDIA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const RESULTS_POST_URL = PROVIDER_METADATA.resultsPostUrl
export const INDIA_FACET_ID = PROVIDER_METADATA.indiaFacetId
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const SIGNAL_PATTERNS = [
  /<title>\s*Search our Job Opportunities at Ford Motor Company\s*<\/title>/i,
  /Search our Job Opportunities at Ford Motor Company/i,
  /search results\./i,
  /Search Jobs/i,
  /Job Category/i,
  /Country:\s*India/i,
  /Chennai,\s*India/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
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
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export { buildResultsRequestBody, buildSearchUrl, extractJobDetail, extractPaginationSummary, extractSearchResults }

export const hasVerifiedFordIndiaCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return SIGNAL_PATTERNS.every((pattern) => pattern.test(page) || pattern.test(normalized))
}
const isDeclaredCurrentLocalePage=page=>{
  const current=new URL(CAREERS_URL);current.pathname='/en'+current.pathname
  return page?.status===200&&page.url===current.href&&hasVerifiedFordIndiaCareersPageSignal(page.html)
    &&String(page.html).includes('data-ajax-post-url="/en/search-jobs/resultspost"')
}

export const decorateFordIndiaJob = (job = {}, scrapedAt) => ({
  ...job,
  company: COMPANY,
  source: SOURCE,
  link: job.link || job.applyUrl || job.sourceUrl || null,
  companyCareerPage: CAREERS_URL,
  companyDomain: PROVIDER_METADATA.companyDomain,
  atsPlatform: PROVIDER_METADATA.atsPlatform,
  scrapedAt,
})

export const createFordIndiaScraper = ({
  maxPages = Number.POSITIVE_INFINITY,
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run(options={}) {
    const {
    fetchPage = defaultFetchPage,
    fetchJson,
    fetchText,
    }=options
    const careersPage = await fetchPage(CAREERS_URL)
    if (
      Number(careersPage?.status) !== 200
      || (String(careersPage?.url ?? '') !== CAREERS_URL&&!isDeclaredCurrentLocalePage(careersPage))
      || !hasVerifiedFordIndiaCareersPageSignal(careersPage?.html)
    ) {
      throw new Error('Ford India verified Ford India careers page no longer matches the pinned public TalentBrew surface')
    }

    const jobs = await createFordMotorPvtLtdScraper({ maxPages, maxJobs }).run({
      ...options,
      fetchJson,
      fetchText,
    })

    const scrapedAt = now()
    const decorated=jobs.map((job) => decorateFordIndiaJob(job, scrapedAt)),evidence=readInventoryEvidence(jobs)
    return evidence?attachInventoryEvidence(decorated,evidence):decorated
  },
})

export const run = async (options = {}) => createFordIndiaScraper(options).run(options)

if (BASE_INDIA_FACET_ID !== INDIA_FACET_ID || BASE_RESULTS_POST_URL !== RESULTS_POST_URL) {
  throw new Error('Ford India wrapper metadata drifted from the verified Ford TalentBrew India contract')
}

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
