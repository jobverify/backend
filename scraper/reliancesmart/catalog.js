import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const RELIANCE_SMART_CATALOG = {
  source: 'reliancesmart',
  companyName: 'Reliance Smart',
  officialBrandName: 'Reliance SMART',
  adapter: 'script',
  homepageUrl: 'https://www.relianceretail.com/',
  companyCareerPage: 'https://www.relianceretail.com/reliance-smart.html',
  verified404Routes: [
    'https://www.relianceretail.com/careers',
    'https://www.relianceretail.com/careers/',
    'https://www.relianceretail.com/jobs',
    'https://www.relianceretail.com/jobs/',
  ],
  companyDomain: 'relianceretail.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'brand-page-plus-common-careers-route-404-validation',
  extractionStrategy: 'verified-brand-page+verified-missing-first-party-careers-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.relianceretail.com/reliance-smart.html is the live official Reliance SMART brand page on Reliance Retail and that it currently presents only brand information, not a trustworthy public jobs surface. Verified also that the obvious first-party careers and jobs routes at https://www.relianceretail.com/careers, https://www.relianceretail.com/careers/, https://www.relianceretail.com/jobs, and https://www.relianceretail.com/jobs/ return first-party 404 pages. No trustworthy public jobs surface is currently exposed for the exact-name brand.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'reliancesmart/jobs.json',
}

export default RELIANCE_SMART_CATALOG
