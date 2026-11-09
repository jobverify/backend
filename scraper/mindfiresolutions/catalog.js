import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MINDFIRE_SOLUTIONS_CATALOG = {
  source: 'mindfiresolutions',
  companyName: 'Mindfire Solutions',
  officialBrandName: 'Mindfire Solutions',
  adapter: 'script',
  homepageUrl: 'https://www.mindfiresolutions.com/',
  companyCareerPage: 'https://www.mindfiresolutions.com/life-at-mindfire-people-culture-career-opportunities/career/',
  jobsApiUrl: 'https://apply.mindfiresolutions.com/api/jobpost',
  atsPlatform: 'mindfire-public-api',
  countryFilter: 'India',
  paginationStrategy: 'single-jobpost-api-payload',
  extractionStrategy: 'verified-first-party-careers-page+official-public-jobpost-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'mindfiresolutions.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that the exact first-party Mindfire Solutions careers shell at https://www.mindfiresolutions.com/life-at-mindfire-people-culture-career-opportunities/career/ advertises "Career Possibilities" and links APPLY NOW to apply.mindfiresolutions.com, and that the official public API endpoint https://apply.mindfiresolutions.com/api/jobpost returns the live job payload used by the first-party apply site.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default MINDFIRE_SOLUTIONS_CATALOG
