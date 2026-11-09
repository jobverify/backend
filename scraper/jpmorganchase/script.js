import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  ATS_PLATFORM as BASE_ATS_PLATFORM,
  CANDIDATE_EXPERIENCE_URL as BASE_CANDIDATE_EXPERIENCE_URL,
  COMPANY_DOMAIN as BASE_COMPANY_DOMAIN,
  COUNTRY_FILTER as BASE_COUNTRY_FILTER,
  CORPORATE_CAREERS_URL as BASE_CAREERS_URL,
  NORMALIZATION_PROFILE as BASE_NORMALIZATION_PROFILE,
  PAGINATION_STRATEGY as BASE_PAGINATION_STRATEGY,
  PARSER as BASE_PARSER,
  buildJobDetailApiUrl,
  buildSearchUrl,
  createChaseIndiaScraper,
  hasOfficialCorporateCareersSignal,
} from '../chaseindia/script.js'

import { JPMORGAN_CHASE_CATALOG } from './catalog.js'
import { mapJobsWithInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const defaultFetchText = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return response.text()
}

export const PROVIDER_METADATA = JPMORGAN_CHASE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const CANDIDATE_EXPERIENCE_URL = PROVIDER_METADATA.officialCandidateExperienceUrl
export const COMPANY_DOMAIN = PROVIDER_METADATA.companyDomain
export const ATS_PLATFORM = PROVIDER_METADATA.atsPlatform
export const COUNTRY_FILTER = PROVIDER_METADATA.countryFilter
export const PAGINATION_STRATEGY = PROVIDER_METADATA.paginationStrategy
export const PARSER = PROVIDER_METADATA.parser
export const NORMALIZATION_PROFILE = PROVIDER_METADATA.normalizationProfile
export const WORKSPACE_DOMAIN = PROVIDER_METADATA.workspaceDomain
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

export { buildJobDetailApiUrl, buildSearchUrl }

export const hasVerifiedJPMorganChaseCareersSignal = (html = '') =>
  hasOfficialCorporateCareersSignal(String(html ?? ''))

export const decorateJPMorganChaseJob = (job = {}, scrapedAt) => ({
  ...job,
  company: COMPANY,
  source: SOURCE,
  link: job.link || job.applyUrl || job.sourceUrl || null,
  companyCareerPage: CAREERS_URL,
  companyDomain: COMPANY_DOMAIN,
  atsPlatform: ATS_PLATFORM,
  scrapedAt,
})

export const createJPMorganChaseScraper = ({
  maxPages = Number.POSITIVE_INFINITY,
  maxJobs = null,
  now = () => new Date().toISOString(),
  signal: factorySignal,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson,
    signal = factorySignal,
  } = {}) {
    signal?.throwIfAborted()
    const corporateCareersHtml = await fetchText(CAREERS_URL, { signal })
    signal?.throwIfAborted()
    if (!hasVerifiedJPMorganChaseCareersSignal(corporateCareersHtml)) {
      throw new Error('JPMorgan Chase verified JPMorgan Chase careers page no longer matches the pinned first-party handoff')
    }

    const scrapedAt = now()
    const cachedFetchText = async (url, options) => {
      signal?.throwIfAborted()
      if (url === CAREERS_URL) return corporateCareersHtml
      return fetchText(url, options)
    }

    const jobs = await createChaseIndiaScraper({
      maxPages,
      maxJobs,
      fetchText: cachedFetchText,
      fetchJson,
      now: () => scrapedAt,
      signal,
    }).run()

    return mapJobsWithInventoryEvidence(jobs, job => decorateJPMorganChaseJob(job, scrapedAt))
  },
})

export const run = async (options = {}) => createJPMorganChaseScraper(options).run(options)

if (
  BASE_CAREERS_URL !== CAREERS_URL
  || BASE_CANDIDATE_EXPERIENCE_URL !== CANDIDATE_EXPERIENCE_URL
  || BASE_COMPANY_DOMAIN !== COMPANY_DOMAIN
  || BASE_ATS_PLATFORM !== ATS_PLATFORM
  || BASE_COUNTRY_FILTER !== COUNTRY_FILTER
  || BASE_PAGINATION_STRATEGY !== PAGINATION_STRATEGY
  || BASE_PARSER !== PARSER
  || BASE_NORMALIZATION_PROFILE !== NORMALIZATION_PROFILE
) {
  throw new Error('JPMorgan Chase wrapper metadata drifted from the verified Chase India Oracle Cloud contract')
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
