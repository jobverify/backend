import {runCurrentAbsolutdata} from './currentNative20261117.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'absolutdata'
export const COMPANY = 'Absolutdata'
export const COMPANY_DOMAIN = 'absolutdata.com'
export const VERIFIED_AT = '2026-07-14'
export const FIRST_PARTY_ROOT_URLS = [
  'https://absolutdata.com/',
  'https://www.absolutdata.com/',
]
export const NO_PUBLIC_JOB_ROUTE_URLS = [
  'https://absolutdata.com/careers',
  'https://www.absolutdata.com/careers',
  'https://absolutdata.com/jobs',
  'https://www.absolutdata.com/jobs',
]
export const SCRAPER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  companyCareerPage: FIRST_PARTY_ROOT_URLS[0],
  companyDomain: COMPANY_DOMAIN,
  countryFilter: 'India',
  atsPlatform: 'official-company-site-no-public-careers',
  paginationStrategy: 'exact-name-domain-root-plus-common-careers-route-timeout-validation',
  extractionStrategy:
    'verified-exact-name-first-party-domains-time-out-plus-common-careers-routes-time-out-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
}

export const isExpectedUnreachableSurface = (surface = {}) =>
  surface?.errorKind === 'timeout'
  && !Number.isInteger(surface?.status)
  && surface?.html == null

export const isUnexpectedReachableSurface = (surface = {}) =>
  Number.isInteger(surface?.status) && surface.status > 0

export const createAbsolutdataScraper = () => ({run:runCurrentAbsolutdata})

export const run = async (options = {}) => createAbsolutdataScraper().run(options)

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
