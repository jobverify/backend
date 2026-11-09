import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 16, 2026 that https://na.itron.com/careers is the live first-party Itron careers page and exposes a View Jobs in India handoff to https://itron.wd5.myworkdayjobs.com/Itron?locationCountry=c4f78be1a8f14da0ab49ce1162348a5e. The India handoff resolves to the public Workday tenant at https://itron.wd5.myworkdayjobs.com/Itron with canonical tenant metadata for Itron, so the provider can conservatively verify the handoff chain before delegating to the shared Workday runner.'

export const ITRON_INDIA_CATALOG = {
  source: 'itronindia',
  companyName: 'Itron India',
  officialBrandName: 'Itron',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'itronindia.workday/jobs.json',
  companyCareerPage: 'https://na.itron.com/careers',
  companyDomain: 'na.itron.com',
  officialHomepageUrl: 'https://na.itron.com/',
  officialWorkdayBoardUrl: 'https://itron.wd5.myworkdayjobs.com/Itron',
  verifiedIndiaWorkdayUrl:
    'https://itron.wd5.myworkdayjobs.com/Itron?locationCountry=c4f78be1a8f14da0ab49ce1162348a5e',
  atsPlatform: 'workday',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-handoff-plus-india-workday-board',
  extractionStrategy:
    'verified-careers-page+verified-india-workday-handoff+verified-workday-board+shared-workday-runner',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default ITRON_INDIA_CATALOG
