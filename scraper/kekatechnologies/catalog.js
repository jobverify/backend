import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const KEKA_TECHNOLOGIES_CATALOG = {
  source: 'kekatechnologies',
  companyName: 'KEKA TECHNOLOGIES',
  officialBrandName: 'Keka Technologies Private Limited',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  companyCareerPage: 'https://hr.keka.com/careers/',
  companyDomain: 'hr.keka.com',
  atsPlatform: 'keka-careers-embed-jobs-api',
  jobsBoardUrl: 'https://hr.keka.com/careers/',
  countryFilter: 'India',
  paginationStrategy: 'verified-keka-careers-shell-plus-active-jobs-api',
  extractionStrategy: 'verified-keka-careers-shell+embedded-career-config+active-jobs-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  dryRunFile: 'kekatechnologies/jobs.json',
  verifiedOn: '2026-08-07',
  verifiedSurfaceSummary:
    "Verified on Friday, August 7, 2026 that https://hr.keka.com/careers/ is the live official Keka careers host, its embedded career portal resolves to identifier 24040a7e-a7c5-47a5-9cd5-019962c66385, and the active jobs API returns current India openings with inline experience values such as 3-6, 4+, and 10+ years.",
}

export default KEKA_TECHNOLOGIES_CATALOG
