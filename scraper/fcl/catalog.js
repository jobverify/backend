import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const FCL_CATALOG = {
  source: 'fcl',
  companyName: 'FCL',
  officialBrandName: 'Firefly Campus Laundry',
  adapter: 'script',
  homepageUrl: 'https://fcl.in/',
  companyCareerPage: 'https://fcl.in/',
  companyDomain: 'fcl.in',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-missing-first-party-careers-routes',
  extractionStrategy: 'verified-homepage-no-careers-links+verified-missing-careers-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://fcl.in/ is the live first-party FCL homepage for Firefly Campus Laundry, that the homepage presents service and contact content for Express Laundry Coimbatore with no public careers or jobs links, and that https://fcl.in/careers, https://fcl.in/career, https://fcl.in/jobs, https://fcl.in/join-us, https://fcl.in/openings, https://fcl.in/work-with-us, and https://fcl.in/current-openings all returned first-party 404 responses. There is no trustworthy public jobs surface for FCL.',
  dryRunFile: 'fcl/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default FCL_CATALOG
