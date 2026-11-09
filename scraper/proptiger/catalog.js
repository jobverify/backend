import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROPTIGER_CATALOG = {
  source: 'proptiger',
  companyName: 'PropTiger',
  officialBrandName: 'PropTiger',
  adapter: 'script',
  homepageUrl: 'https://www.proptiger.com/',
  companyCareerPage: 'https://www.proptiger.com/careers',
  aboutPageUrl: 'https://www.proptiger.com/aboutus',
  companyDomain: 'proptiger.com',
  atsPlatform: 'official-company-careers-empty-board',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-page-empty-state-validation',
  extractionStrategy: 'verified-first-party-careers-page+verified-empty-open-roles-state+return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  officialReachOutFormAction: 'https://www.proptiger.com/responsive/jhr/careers/right-opportunity',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.proptiger.com/careers is the live official PropTiger careers page, that it advertises "Build your Career at PropTiger" while explicitly stating "There are currently no jobs available", and that the page only exposes the reach-out form action /responsive/jhr/careers/right-opportunity rather than trustworthy public job listings.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default PROPTIGER_CATALOG
