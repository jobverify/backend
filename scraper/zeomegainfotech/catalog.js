import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const BOARD_URL =
  'https://career10.successfactors.com/career?company=zeomegainf&career_ns=job_listing_summary&navBarLevel=JOB_SEARCH'

export const VERIFIED_SURFACE_SUMMARY =
  `Verified on Saturday, July 18, 2026 that https://www.zeomega.com/company/careers-india was the live first-party ZeOmega India careers handoff page and exposed Careers (India), Available Careers, Working at ZeOmega, and Employee Benefits. The first-party SuccessFactors board at ${BOARD_URL} returned an error page stating "An error occurred while processing your request", so this provider is fail-closed until a stable public board becomes available.`

export const ZEOMEGA_INFOTECH_CATALOG = {
  source: 'zeomegainfotech',
  companyName: 'Zeomega Infotech',
  officialBrandName: 'ZeOmega',
  adapter: 'script',
  homepageUrl: 'https://www.zeomega.com/',
  companyCareerPage: 'https://www.zeomega.com/company/careers-india',
  boardUrl: BOARD_URL,
  companyDomain: 'zeomega.com',
  atsPlatform: 'official-company-careers-handoff+blocked-successfactors',
  countryFilter: 'India',
  paginationStrategy: 'first-party-india-careers-page-plus-erroring-successfactors-handoff',
  extractionStrategy: 'verified-india-careers-page+verified-blocked-successfactors-handoff-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'zeomegainfotech/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default ZEOMEGA_INFOTECH_CATALOG
