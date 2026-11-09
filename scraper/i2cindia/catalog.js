import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const I2C_INDIA_CATALOG = {
  source: 'i2cindia',
  companyName: 'i2c India',
  officialBrandName: 'i2c',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  companyCareerPage: 'https://careers.i2cinc.com/careers/',
  officialCareersLandingUrl: 'https://www.i2cinc.com/who-we-are/supercharge-your-career/',
  officialJobsListUrl: 'https://careers.i2cinc.com/careers/',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-official-careers-landing-plus-public-jobs-list-empty-india-sentinel',
  extractionStrategy:
    'verified-official-careers-landing-handoff+verified-public-jobs-list-no-india-location-filter-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'i2cinc.com',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that the official i2c careers landing page https://www.i2cinc.com/who-we-are/supercharge-your-career/ hands applicants to the live public jobs list at https://careers.i2cinc.com/careers/, and that the verified jobs surface showed 89 open positions with location filters for United States and Pakistan but no India location filter or India jobs on the verified date.',
  dryRunFile: 'i2cindia/jobs.json',
}

export default I2C_INDIA_CATALOG
