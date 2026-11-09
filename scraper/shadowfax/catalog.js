import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SHADOWFAX_CATALOG = {
  source: 'shadowfax',
  companyName: 'Shadowfax',
  officialBrandName: 'Shadowfax',
  legalEntityName: 'Shadowfax Technologies Limited',
  adapter: 'script',
  homepageUrl: 'https://www.shadowfax.in/',
  companyCareerPage: 'https://www.shadowfax.in/careers',
  companyDomain: 'shadowfax.in',
  checkedNoPublicJobsRouteUrls: [
    'https://www.shadowfax.in/career',
    'https://www.shadowfax.in/jobs',
  ],
  atsPlatform: 'official-company-careers-empty-state',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-careers-empty-state-plus-adjacent-route-404-validation',
  extractionStrategy: 'verified-homepage+verified-careers-empty-state+verified-missing-adjacent-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.shadowfax.in/ is the live official Shadowfax homepage and links Company > Careers to https://www.shadowfax.in/careers, that the official careers page currently says "No job openings available at the moment." while exposing only a talent-pool CV upload form, and that adjacent first-party routes https://www.shadowfax.in/career and https://www.shadowfax.in/jobs returned 404 pages. The verified first-party surface exposes no trustworthy public jobs listings right now for Shadowfax Technologies Limited.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default SHADOWFAX_CATALOG
