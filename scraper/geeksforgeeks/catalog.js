import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 16, 2026 that https://www.geeksforgeeks.org/jobs/ is the live first-party GeeksforGeeks jobs hub, that its Next.js __NEXT_DATA__ payload exposes activeJobData, and that the public jobs API at https://practiceapi.geeksforgeeks.org/api/vr/jobs/?status=active currently contains 7 active GeeksforGeeks jobs when filtered by organization name. The verified contract is the first-party jobs page plus the linked public API pagination.'

export const GEEKSFORGEEKS_CATALOG = {
  source: 'geeksforgeeks',
  companyName: 'GeeksforGeeks',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'geeksforgeeks/jobs.json',
  homepageUrl: 'https://www.geeksforgeeks.org/about/',
  companyCareerPage: 'https://www.geeksforgeeks.org/jobs/',
  jobsApiUrl: 'https://practiceapi.geeksforgeeks.org/api/vr/jobs/?status=active',
  companyDomain: 'geeksforgeeks.org',
  atsPlatform: 'official-company-careers-api',
  countryFilter: 'India',
  paginationStrategy: 'next-link-api-pagination',
  extractionStrategy: 'nextjs-seed-page+public-jobs-api-filtered-by-organization-name',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default GEEKSFORGEEKS_CATALOG
