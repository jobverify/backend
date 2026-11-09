import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CORNERSTONE_ONDEMAND_CATALOG = {
  source: 'cornerstoneondemand',
  companyName: 'Cornerstone OnDemand',
  officialBrandName: 'Cornerstone',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'cornerstoneondemand/jobs.json',
  companyCareerPage: 'https://www.cornerstoneondemand.com/careers/',
  officialJobsBoardUrl: 'https://cornerstone.csod.com/ux/ats/careersite/2/home?c=cornerstone',
  companyDomain: 'cornerstoneondemand.com',
  atsPlatform: 'cornerstone-csod',
  countryFilter: 'India',
  paginationStrategy: 'public-csod-search-api-with-postings-window',
  extractionStrategy:
    'verified-first-party-careers-page-handoff+public-csod-board-context+india-location-filter+extended-postings-window',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-01',
  verifiedPublicJobCount: 69,
  verifiedIndiaJobCount: 42,
  verifiedSurfaceSummary:
    'Verified on Saturday, August 1, 2026 that https://www.cornerstoneondemand.com/careers/ is the live first-party Cornerstone careers page and that its Search Open Positions CTA leads to the public CSOD board at https://cornerstone.csod.com/ux/ats/careersite/2/home?c=cornerstone. The current CSOD context is now exposed on the public board page rather than the marketing handoff page, and the public requisition search at https://us-galaxy.api.csod.com/ returned 69 total jobs once postingsWithinDays=3650 was supplied, including 42 India jobs across Pune, Hyderabad, and Mumbai.',
}

export default CORNERSTONE_ONDEMAND_CATALOG
