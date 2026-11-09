import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const LOYLTY_REWARDZ_MNGT_CATALOG = {
  source: 'loyltyrewardzmngt',
  companyName: 'Loylty Rewardz Mngt',
  officialBrandName: 'Loylty Rewardz Mngt Pvt. Ltd.',
  adapter: 'script',
  companyCareerPage: 'https://loylty.com/about/careers/',
  companyDomain: 'loylty.com',
  atsPlatform: 'official-careers-culture-page-no-public-jobs',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-culture-page',
  extractionStrategy: 'verified-first-party-careers-culture-page+no-public-job-surface+return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedPublicJobCount: 0,
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://loylty.com/about/careers/ remained the first-party Loylty Rewardz careers page, that it surfaced culture and work-life content such as "Bringing value to the workplace for a well-rounded worklife" and "Health & Wellness", and that it did not expose any trustworthy public job listings or ATS handoff. This provider therefore remains fail-closed.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default LOYLTY_REWARDZ_MNGT_CATALOG
