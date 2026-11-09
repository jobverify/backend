import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const NINELEAPS_TECHNOLOGY_SOLUTIONS_CATALOG = {
  source: 'nineleapstechnologysolutions',
  companyName: 'Nineleaps Technology Solutions',
  officialBrandName: 'Nineleaps',
  adapter: 'script',
  homepageUrl: 'https://www.nineleaps.com/',
  companyCareerPage: 'https://www.nineleaps.com/jobs/',
  officialCareersPageUrl: 'https://www.nineleaps.com/careers/',
  companyDomain: 'nineleaps.com',
  atsPlatform: 'official-first-party-job-pages',
  countryFilter: 'India',
  paginationStrategy: 'single-page-job-index',
  extractionStrategy: 'first-party-job-card-list+detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.nineleaps.com/careers/ and https://www.nineleaps.com/jobs/ were the live first-party Nineleaps careers surfaces and that the public jobs index exposed India-facing openings including Full Stack Developer and AI Engineer on the verified date.',
  dryRunFile: 'nineleapstechnologysolutions/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default NINELEAPS_TECHNOLOGY_SOLUTIONS_CATALOG
