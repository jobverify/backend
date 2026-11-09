import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 18, 2026 that https://www.cerence.com/about/careers is the live first-party Cerence AI careers page and that its View All Open Positions CTA hands off to the public Workday board at https://cerence.wd5.myworkdayjobs.com/Cerence. Public Cerence Workday detail pages also exposed India openings in Hinjewadi, Pune, including Research Scientist and Sr High Performance Compute Engineer, so the local provider delegates to the shared Workday runner with India filtering.'

export const CERENCE_CATALOG = {
  source: 'cerence',
  companyName: 'Cerence',
  officialBrandName: 'Cerence AI',
  adapter: 'script',
  companyCareerPage: 'https://www.cerence.com/about/careers',
  officialCareersPageUrl: 'https://www.cerence.com/about/careers',
  officialWorkdayBoardUrl: 'https://cerence.wd5.myworkdayjobs.com/Cerence',
  companyDomain: 'cerence.com',
  atsPlatform: 'workday',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-handoff-plus-workday-india-filter',
  extractionStrategy:
    'verified-first-party-careers-page+verified-workday-handoff+shared-workday-runner',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'cerence.workday/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default CERENCE_CATALOG
