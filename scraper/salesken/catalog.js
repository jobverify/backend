import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SALESKEN_CATALOG = {
  source: 'salesken',
  companyName: 'Salesken',
  officialBrandName: 'Salesken',
  adapter: 'script',
  homepageUrl: 'https://www.salesken.ai/',
  companyCareerPage: 'https://www.salesken.ai/careers',
  verifiedJobsPageUrl: 'https://www.salesken.ai/jobs',
  companyDomain: 'salesken.ai',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-missing-careers-and-jobs-route-validation',
  extractionStrategy:
    'verified-homepage-navigation+verified-missing-careers-and-jobs-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.salesken.ai/ is the live official Salesken homepage, that the visible first-party navigation stays limited to product, pricing, demo, and legal routes with no careers handoff, and that the common exact-name public jobs routes https://www.salesken.ai/careers and https://www.salesken.ai/jobs both returned first-party 404 responses. No trustworthy public jobs surface was verifiable for Salesken.',
  dryRunFile: 'salesken/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SALESKEN_CATALOG
