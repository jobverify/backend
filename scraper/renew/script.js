import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  CAREER_PAGE_URL as BASE_CAREERS_URL,
  COMPANY as BASE_COMPANY,
  USER_AGENT,
  buildSearchUrl,
  createRenewPowerScraper,
  hasOfficialEmptyStateSignal,
  hasOfficialSearchResultsSignal,
} from '../renewpower/script.js'

import { RENEW_CATALOG } from './catalog.js'

import { runPublishedReNewPartial } from '../renewpower/publishedLinkedIn.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const PROVIDER_METADATA = RENEW_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const COMPANY_DOMAIN = PROVIDER_METADATA.companyDomain
export const ATS_PLATFORM = PROVIDER_METADATA.atsPlatform
export const COUNTRY_FILTER = PROVIDER_METADATA.countryFilter
export const PAGINATION_STRATEGY = PROVIDER_METADATA.paginationStrategy
export const PARSER = PROVIDER_METADATA.parser
export const NORMALIZATION_PROFILE = PROVIDER_METADATA.normalizationProfile
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

export { buildSearchUrl }

export const hasVerifiedReNewJobsPageSignal = (html = '') =>
  hasOfficialSearchResultsSignal(String(html ?? ''))
  || hasOfficialEmptyStateSignal(String(html ?? ''))

export const decorateReNewJob = (job = {}, scrapedAt) => ({
  ...job,
  company: COMPANY,
  source: SOURCE,
  link: job.link || job.applyUrl || job.sourceUrl || null,
  companyCareerPage: job.sourceUrl?.startsWith('https://careers.renew.com/') ? BASE_CAREERS_URL : CAREERS_URL,
  companyDomain: job.sourceUrl?.startsWith('https://careers.renew.com/') ? 'careers.renew.com' : COMPANY_DOMAIN,
  atsPlatform: job.sourceUrl?.startsWith('https://careers.renew.com/') ? 'successfactors' : ATS_PLATFORM,
  scrapedAt,
})

export const createReNewScraper = ({
  maxPages = null,
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run(options = {}) {
    if (!Object.hasOwn(options, 'fetchText') || options.fetchPublishedText) {
      return runPublishedReNewPartial({ ...options, maxPages: options.maxPages ?? maxPages, maxJobs: options.maxJobs ?? maxJobs, now: options.now ?? now, source: SOURCE, company: COMPANY })
    }
    const { fetchText = defaultFetchText } = options
    const searchUrl = buildSearchUrl()
    const searchPageHtml = await fetchText(searchUrl)
    if (!hasVerifiedReNewJobsPageSignal(searchPageHtml)) {
      throw new Error('ReNew verified ReNew jobs page no longer matches the pinned first-party search surface')
    }

    const cachedFetchText = async (url) => {
      if (url === searchUrl) return searchPageHtml
      return fetchText(url)
    }

    const scrapedAt = now()
    const jobs = await createRenewPowerScraper().run({
      maxPages,
      maxJobs,
      fetchText: cachedFetchText,
      now: () => scrapedAt,
    })

    return jobs.map((job) => decorateReNewJob(job, scrapedAt))
  },
})

export const run = async (options = {}) => createReNewScraper(options).run(options)

if (BASE_CAREERS_URL !== 'https://careers.renew.com/' || BASE_COMPANY !== OFFICIAL_BRAND_NAME) {
  throw new Error('ReNew wrapper metadata drifted from the verified ReNew Power contract')
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
