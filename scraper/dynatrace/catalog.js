import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const DYNATRACE_CATALOG = {
  source: 'dynatrace',
  companyName: 'Dynatrace',
  officialBrandName: 'Dynatrace',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'dynatrace/jobs.json',
  officialCareersLandingUrl: 'https://www.dynatrace.com/careers/',
  companyCareerPage: 'https://www.dynatrace.com/careers/jobs/',
  locationsOverviewUrl: 'https://www.dynatrace.com/careers/locations/',
  bengaluruLocationUrl: 'https://www.dynatrace.com/careers/locations/bengaluru/',
  mumbaiLocationUrl: 'https://www.dynatrace.com/careers/locations/mumbai/',
  officialOfficeLocationsUrl: 'https://www.dynatrace.com/company/locations/',
  officialIndiaLegalEntity: 'Dynatrace India Software Operations Pvt. Ltd.',
  atsPlatform: 'official-first-party-careers-pages',
  countryFilter: 'India',
  paginationStrategy:
    'first-party-all-jobs-page-plus-india-location-pages-currently-contradictory-empty-slice',
  extractionStrategy:
    'verified-first-party-all-jobs-page+verified-india-location-pages+verified-office-locations-page+documented-india-job-count-mismatch+return-empty-until-public-listings-reappear',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'dynatrace.com',
  verifiedOn: '2026-08-17',
  verifiedSurfaceSummary:
    'Verified on Monday, August 17, 2026 that Dynatrace uses the first-party careers surfaces at https://www.dynatrace.com/careers/, https://www.dynatrace.com/careers/jobs/, and https://www.dynatrace.com/careers/locations/. The live all-jobs page stated 0 open positions on the verified date, while the first-party locations overview showed India Bengaluru 1 job and India Mumbai 2 jobs. Both live India location pages at https://www.dynatrace.com/careers/locations/bengaluru/ and https://www.dynatrace.com/careers/locations/mumbai/ resolved to Dynatrace India Software Operations Pvt. Ltd. office pages with Explore all jobs links but no trustworthy first-party role cards, so this provider still documents a contradictory first-party India surface and returns an empty verified slice instead of forcing stale listings.',
}

export default DYNATRACE_CATALOG
