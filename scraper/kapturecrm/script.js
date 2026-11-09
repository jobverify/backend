import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserNetworkFallback } from '../../scraper-support/shared/browserNetworkFallback.js'
import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import {
  ACTIVE_JOBS_URL as BASE_ACTIVE_JOBS_URL,
  CAREER_PAGE_URL as BASE_CAREERS_URL,
  DEPARTMENTS_URL as BASE_DEPARTMENTS_URL,
  EMBED_CONFIG_URL as BASE_EMBED_CONFIG_URL,
  PROVIDER_METADATA as BASE_PROVIDER_METADATA,
  createKaptureScraper,
} from '../kapture/script.js'

import { KAPTURE_CRM_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const EMBED_IDENTIFIER = '30315393-d861-4cad-851c-03e99c4fe979'

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/javascript,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return response.text()
}

const defaultFetchJson = async (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: `${SOURCE}-json`,
  timeoutMs: 15000,
})

export const PROVIDER_METADATA = KAPTURE_CRM_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const EMBED_CONFIG_URL = PROVIDER_METADATA.embedConfigUrl
export const ACTIVE_JOBS_URL = PROVIDER_METADATA.activeJobsUrl
export const DEPARTMENTS_URL = PROVIDER_METADATA.departmentsUrl
export const COMPANY_DOMAIN = PROVIDER_METADATA.companyDomain
export const ATS_PLATFORM = PROVIDER_METADATA.atsPlatform
export const COUNTRY_FILTER = PROVIDER_METADATA.countryFilter
export const PAGINATION_STRATEGY = PROVIDER_METADATA.paginationStrategy
export const PARSER = PROVIDER_METADATA.parser
export const NORMALIZATION_PROFILE = PROVIDER_METADATA.normalizationProfile
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

export const hasVerifiedKaptureCrmCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const hasCanonicalLink =
    /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.kapture\.cx\/careers\/["']/i.test(page)
    || /<link[^>]+href=["']https:\/\/www\.kapture\.cx\/careers\/["'][^>]+rel=["']canonical["']/i.test(page)

  return hasCanonicalLink
    && /Kapture Careers/i.test(page)
    && /window\.khConfig/i.test(page)
    && hasVerifiedKaptureCrmEmbedConfigSignal(page)
}

export const hasVerifiedKaptureCrmEmbedConfigSignal = (scriptText = '') =>
  new RegExp(EMBED_IDENTIFIER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(String(scriptText ?? ''))

export const decorateKaptureCrmJob = (job = {}, scrapedAt) => ({
  ...job,
  company: COMPANY,
  source: SOURCE,
  link: job.link || job.applyUrl || job.sourceUrl || null,
  companyCareerPage: CAREERS_URL,
  companyDomain: COMPANY_DOMAIN,
  atsPlatform: ATS_PLATFORM,
  scrapedAt,
})

export const createKaptureCrmScraper = ({
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    fetchBrowserText,
    fetchBrowserJson,
  } = {}) {
    const browserFallback = createBrowserNetworkFallback({
      fetchText,
      fetchJson,
      fetchBrowserText,
      fetchBrowserJson,
      userAgent: USER_AGENT,
      browserSessionOptions: {
        timeoutMs: 90000,
        settleTimeMs: 12000,
        ignoreHTTPSErrors: false,
      },
    })

    try {
      const careersPageHtml = await browserFallback.fetchText(CAREERS_URL)
      if (!hasVerifiedKaptureCrmCareersPageSignal(careersPageHtml)) {
        throw new Error('Kapture CRM verified Kapture CRM careers page no longer matches the pinned first-party surface')
      }

      let embedConfigText = careersPageHtml
      try {
        const embedConfigCandidate = await browserFallback.fetchText(EMBED_CONFIG_URL)
        if (hasVerifiedKaptureCrmEmbedConfigSignal(embedConfigCandidate)) {
          embedConfigText = embedConfigCandidate
        }
      } catch {
        // The first-party careers page already exposes the pinned khConfig payload.
      }

      const cachedFetchText = async (url) => {
        if (url === CAREERS_URL) return careersPageHtml
        if (url === EMBED_CONFIG_URL) return embedConfigText
        return browserFallback.fetchText(url)
      }

      const cachedFetchJson = async (url, options = {}) => browserFallback.fetchJson(url, options)

      const jobs = await createKaptureScraper({ maxJobs }).run({
        fetchText: cachedFetchText,
        fetchJson: cachedFetchJson,
      })

      const scrapedAt = now()
      return jobs.map((job) => decorateKaptureCrmJob(job, scrapedAt))
    } finally {
      await browserFallback.close()
    }
  },
})

export const run = async (options = {}) => createKaptureCrmScraper(options).run(options)

if (
  BASE_CAREERS_URL !== CAREERS_URL
  || BASE_EMBED_CONFIG_URL !== EMBED_CONFIG_URL
  || BASE_ACTIVE_JOBS_URL !== ACTIVE_JOBS_URL
  || BASE_DEPARTMENTS_URL !== DEPARTMENTS_URL
  || BASE_PROVIDER_METADATA.companyDomain !== COMPANY_DOMAIN
  || BASE_PROVIDER_METADATA.atsPlatform !== ATS_PLATFORM
) {
  throw new Error('Kapture CRM wrapper metadata drifted from the verified Kapture Keka contract')
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
