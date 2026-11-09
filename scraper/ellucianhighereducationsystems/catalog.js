import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ELLUCIAN_HIGHER_EDUCATION_SYSTEMS_CATALOG = {
  source: 'ellucianhighereducationsystems',
  companyName: 'Ellucian Higher Education Systems',
  officialBrandName: 'Ellucian',
  adapter: 'script',
  homepageUrl: 'https://careers.ellucian.com/',
  companyCareerPage: 'https://careers.ellucian.com/jobs/locations/country/India',
  companyDomain: 'careers.ellucian.com',
  atsPlatform: 'official-jibe-search',
  countryFilter: 'India',
  paginationStrategy: 'jibe-india-location-page-plus-public-jobs-api',
  extractionStrategy: 'verified-india-location-page+verified-jibe-public-jobs-api+empty-india-results',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://careers.ellucian.com/jobs/locations/country/India was the live first-party Ellucian India jobs/locations/country/India surface, that it embedded the public Jibe searchConfig needed to query /api/jobs, and that the verified India-filtered public API returned an empty jobs array on the verified date.',
  dryRunFile: 'ellucianhighereducationsystems/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default ELLUCIAN_HIGHER_EDUCATION_SYSTEMS_CATALOG
