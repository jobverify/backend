import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const M2P_FINTECH_CATALOG = {
  source: 'm2pfintech',
  companyName: 'M2P Fintech',
  officialBrandName: 'M2P Fintech',
  adapter: 'script',
  companyCareerPage: 'https://careers.m2pfintech.com/view-jobs/',
  careersHomeUrl: 'https://careers.m2pfintech.com/',
  officialBrandSiteUrl: 'https://m2pfintech.com/',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-single-first-party-jobs-page',
  extractionStrategy: 'verified-first-party-careers-homepage+verified-zero-openings-jobs-page-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'm2pfintech.com',
  dryRunFile: 'm2pfintech/jobs.json',
  verifiedOn: '2026-08-03',
  verifiedPublicPostingCount: 0,
  verifiedSurfaceSummary:
    'Verified on Monday, August 3, 2026 that https://careers.m2pfintech.com/ is still the current first-party M2P Fintech careers homepage with a visible View Jobs handoff to https://careers.m2pfintech.com/view-jobs/. The live first-party jobs page still renders the heading "Our Job Openings" and the explicit empty-state copy "No Jobs Found" plus "Keep exploring this space.", so the verified public jobs surface currently has zero openings and should return an honest empty result.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default M2P_FINTECH_CATALOG
