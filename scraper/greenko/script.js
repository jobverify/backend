import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mapJobsWithInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

import {
  COMPANY_NAME as BASE_COMPANY,
  fetchOfficialGreenkoText,
  OFFICIAL_HOMEPAGE_URL as BASE_HOMEPAGE_URL,
  PUBLIC_JOBS_URL as BASE_PUBLIC_JOBS_URL,
  SOURCE as BASE_SOURCE,
  createGreenkoHubScraper,
  withGreenkoCallerCancellation,
  hasOfficialGreenkoHubHomepageSignals,
} from '../greenkohub/script.js'

import { GREENKO_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const defaultFetchText = (url, { signal } = {}) => fetchOfficialGreenkoText(url, {
  ...(signal ? { signal } : {}),
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'greenko-official',
  timeoutMs: 15000,
})

const normalizeVerifiedHomepageHtml = (html = '') =>
  String(html ?? '').replace(/\u00e2\u20ac\u2122/g, '\u2019')

const adaptListingPayload = (payload = {}, { page = 1, pageSize = 10 } = {}) => {
  if (Array.isArray(payload?.data) || !Array.isArray(payload?.jobs)) {
    return payload
  }

  const data = payload.jobs.map((job) => ({
    id: job.jobId || job.requisitionId || null,
    title: job.title || null,
    department_name: job.department || null,
    locations: job.location || null,
    country: job.country || null,
    emp_type_name: job.employmentType || null,
    experience: job.experienceRequired || null,
    posted_on: job.postingDate || null,
    jd: job.jobDescription || null,
  }))

  return {
    data,
    job_counts: payload.hasNextPage
      ? String(page * pageSize + 1)
      : String((page - 1) * pageSize + data.length),
  }
}

export const PROVIDER_METADATA = GREENKO_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.companyCareerPage
export const PUBLIC_JOBS_URL = BASE_PUBLIC_JOBS_URL
export const COMPANY_DOMAIN = PROVIDER_METADATA.companyDomain
export const ATS_PLATFORM = PROVIDER_METADATA.atsPlatform
export const COUNTRY_FILTER = PROVIDER_METADATA.countryFilter
export const PAGINATION_STRATEGY = PROVIDER_METADATA.paginationStrategy
export const PARSER = PROVIDER_METADATA.parser
export const NORMALIZATION_PROFILE = PROVIDER_METADATA.normalizationProfile
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

export const hasVerifiedGreenkoHomepageSignal = (html = '') =>
  hasOfficialGreenkoHubHomepageSignals(normalizeVerifiedHomepageHtml(html))

export const decorateGreenkoJob = (job = {}, scrapedAt) => ({
  ...job,
  company: COMPANY,
  source: SOURCE,
  link: job.link || job.applyUrl || job.sourceUrl || null,
  companyCareerPage: HOMEPAGE_URL,
  companyDomain: COMPANY_DOMAIN,
  atsPlatform: ATS_PLATFORM,
  scrapedAt,
})

export const createGreenkoScraper = ({
  maxPages,
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchListingPage,
    fetchJobDetail,
    signal,
  } = {}) {
    return withGreenkoCallerCancellation(signal, async () => {
      const homepageHtml = await fetchText(HOMEPAGE_URL, { signal })
      signal?.throwIfAborted()

      if (!hasVerifiedGreenkoHomepageSignal(homepageHtml)) {
        throw new Error('Greenko verified Greenko homepage no longer matches the pinned first-party surface')
      }

      const normalizedHomepageHtml = normalizeVerifiedHomepageHtml(homepageHtml)
      const cachedFetchText = async (url, options = {}) => {
        signal?.throwIfAborted()
        if (url === HOMEPAGE_URL || url === BASE_HOMEPAGE_URL) return normalizedHomepageHtml
        return fetchText(url, options)
      }
      const adaptedFetchListingPage = fetchListingPage
        ? async (args = {}) => adaptListingPayload(await fetchListingPage(args), args)
        : undefined

      const scrapedAt = now()
      const baseRunOptions = {
        fetchText: cachedFetchText,
        fetchListingPage: adaptedFetchListingPage,
        fetchJobDetail,
        signal,
      }
      if (maxPages != null) {
        baseRunOptions.maxPages = maxPages
      }

      const jobs = await createGreenkoHubScraper({
        maxJobs,
        now: () => scrapedAt,
      }).run(baseRunOptions)
      signal?.throwIfAborted()

      return mapJobsWithInventoryEvidence(jobs, (job) => decorateGreenkoJob(job, scrapedAt))
    })
  },
})

export const run = async (options = {}) => createGreenkoScraper(options).run(options)

if (
  BASE_SOURCE !== 'greenkohub'
  || BASE_COMPANY !== OFFICIAL_BRAND_NAME
  || BASE_HOMEPAGE_URL !== HOMEPAGE_URL
  || BASE_PUBLIC_JOBS_URL !== PUBLIC_JOBS_URL
) {
  throw new Error('Greenko wrapper metadata drifted from the verified Greenko Hub contract')
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
