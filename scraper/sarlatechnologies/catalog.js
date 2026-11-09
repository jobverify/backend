import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SARLA_TECHNOLOGIES_CATALOG = {
  source: 'sarlatechnologies',
  companyName: 'Sarla Technologies',
  officialBrandName: 'Sarla Technologies',
  adapter: 'script',
  homepageUrl: 'https://sarlatech.com/',
  companyCareerPage: 'https://sarlatech.com/career/current-openings/',
  verifiedCareerLandingPageUrl: 'https://sarlatech.com/career/',
  sampleIndiaJobUrl: 'https://sarlatech.com/job/sicam-engineer-substation-automation/',
  sampleNonIndiaJobUrl: 'https://sarlatech.com/job/scms-engineer/',
  companyDomain: 'sarlatech.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'current-openings-list-plus-first-party-detail-pages',
  extractionStrategy:
    'verified-current-openings-page+verified-first-party-job-detail-pages+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://sarlatech.com/career/current-openings/ is the live official Sarla Technologies current openings page and that it links directly to first-party job detail pages under https://sarlatech.com/job/. Verified India detail coverage including https://sarlatech.com/job/sicam-engineer-substation-automation/ and verified non-India detail coverage including https://sarlatech.com/job/scms-engineer/. The current openings surface exposed six live roles during verification, with four India-based roles and two UAE-based roles, so this provider is pinned to the verified India subset only.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'sarlatechnologies/jobs.json',
}

export default SARLA_TECHNOLOGIES_CATALOG
