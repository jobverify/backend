import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const IT_CONVERGENCE_CATALOG = {
  source: 'itconvergence',
  companyName: 'IT Convergence',
  officialBrandName: 'IT Convergence',
  adapter: 'script',
  companyCareerPage: 'https://www.itconvergence.com/careers/',
  homepageUrl: 'https://www.itconvergence.com/',
  atsPlatform: 'first-party-no-public-jobs-sentinel',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-page-without-public-listings',
  extractionStrategy:
    'verified-first-party-careers-page+no-public-openings-signals+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'itconvergence.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that the first-party page at https://www.itconvergence.com/careers/ rendered the title Careers - IT Convergence and the body copy Why IT Convergence and Life at IT Convergence, and that there is no trustworthy public jobs surface or public openings feed to scrape safely.',
  dryRunFile: 'itconvergence/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default IT_CONVERGENCE_CATALOG
