import {finish,nativeFetch} from './native.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  CAREERS_URL as BASE_CAREERS_URL,
  COMPANY as BASE_COMPANY,
  COMPANY_DOMAIN as BASE_COMPANY_DOMAIN,
  HOMEPAGE_URL as BASE_HOMEPAGE_URL,
  SOURCE as BASE_SOURCE,
  createSamcoSecuritiesLimitedScraper,
  hasOfficialCareersSignal,
  hasOfficialHomepageSignal,
} from '../samcosecuritieslimited/script.js'

import { SAMCO_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const defaultFetchText = nativeFetch

export const PROVIDER_METADATA = SAMCO_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const COMPANY_DOMAIN = PROVIDER_METADATA.companyDomain
export const ATS_PLATFORM = PROVIDER_METADATA.atsPlatform
export const COUNTRY_FILTER = PROVIDER_METADATA.countryFilter
export const PAGINATION_STRATEGY = PROVIDER_METADATA.paginationStrategy
export const PARSER = PROVIDER_METADATA.parser
export const NORMALIZATION_PROFILE = PROVIDER_METADATA.normalizationProfile
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

export const hasVerifiedSamcoHomepageSignal = (html = '') =>
  hasOfficialHomepageSignal(String(html ?? ''))

export const hasVerifiedSamcoCareersSignal = (html = '') =>
  hasOfficialCareersSignal(String(html ?? ''))

export const decorateSamcoJob = (job = {}, scrapedAt) => ({
  ...job,
  company: COMPANY,
  source: SOURCE,
  link: job.link || job.applyUrl || job.sourceUrl || null,
  companyCareerPage: CAREERS_URL,
  companyDomain: COMPANY_DOMAIN,
  atsPlatform: ATS_PLATFORM,
  scrapedAt,
})

export const createSamcoScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,fetchData,signal,now:overrideNow,
  } = {}) {
    signal?.throwIfAborted()
    const homepageHtml = await fetchText(HOMEPAGE_URL,{signal})
    if (!hasVerifiedSamcoHomepageSignal(homepageHtml)) {
      throw new Error('Samco verified Samco homepage no longer matches the pinned first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL,{signal})
    if (!hasVerifiedSamcoCareersSignal(careersHtml)) {
      throw new Error('Samco verified Samco careers page no longer matches the pinned first-party surface')
    }

    const cachedFetchText = async (url,options) => {
      if (url === HOMEPAGE_URL) return homepageHtml
      if (url === CAREERS_URL) return careersHtml
      return fetchText(url,options)
    }

    const scrapedAt = (overrideNow||now)()
    const jobs = await createSamcoSecuritiesLimitedScraper({
      now: () => scrapedAt,
    }).run({
      fetchText: cachedFetchText,fetchData,signal,
    })

    return finish(jobs.map((job) => decorateSamcoJob(job, scrapedAt)),{...jobs.nativeCollectionEvidence,source:SOURCE,now:()=>scrapedAt})
  },
})

export const run = async (options = {}) => createSamcoScraper(options).run(options)

if (
  BASE_SOURCE !== 'samcosecuritieslimited'
  || BASE_COMPANY !== OFFICIAL_BRAND_NAME
  || BASE_HOMEPAGE_URL !== HOMEPAGE_URL
  || BASE_CAREERS_URL !== CAREERS_URL
  || BASE_COMPANY_DOMAIN !== COMPANY_DOMAIN
) {
  throw new Error('Samco wrapper metadata drifted from the verified SAMCO Securities Limited contract')
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
