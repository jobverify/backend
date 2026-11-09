import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ENOAH_ISOLUTION_CATALOG = {
  source: 'enoahisolution',
  companyName: 'eNoah iSolution',
  officialBrandName: 'eNoah iSolution',
  adapter: 'script',
  homepageUrl: 'https://enoahisolution.com/',
  companyCareerPage: 'https://enoahisolution.com/careers/',
  jobsBoardUrl: 'https://enoahisolution.com/careers/jobs/',
  atsPlatform: 'official-company-careers-zero-openings',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy: 'verified-first-party-careers-page+zero-public-openings',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'enoahisolution.com',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary:
    'Verified on Sunday, August 2, 2026 that https://enoahisolution.com/careers/ remained the exact first-party eNoah iSolution careers page, linked to https://enoahisolution.com/careers/jobs/, and that the public Current Job Opportunities page still stated We currently have no job openings.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default ENOAH_ISOLUTION_CATALOG
