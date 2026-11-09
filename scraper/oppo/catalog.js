import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const OPPO_CATALOG = {
  source: 'oppo',
  companyName: 'Oppo',
  officialBrandName: 'OPPO',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'oppo/jobs.json',
  homepageUrl: 'https://career.oppo.com/official/oppo',
  companyCareerPage: 'https://career.oppo.com/official/oppo/recruitment/post?recruitType=SOCIAL-RECRUITMENT',
  jobsBoardUrl: 'https://career.oppo.com/official/oppo/recruitment/post?recruitType=SOCIAL-RECRUITMENT',
  campusJobsBoardUrl: 'https://careers.oppo.com/university/oppo/campus/post',
  socialApiUrl: 'https://career.oppo.com/ats-candidate-api/open-api/position/queryPositionList',
  campusApiUrl: 'https://careers.oppo.com/openapi/position/pageNew',
  companyDomain: 'oppo.com',
  atsPlatform: 'official-company-api',
  countryFilter: 'India',
  paginationStrategy: 'page-number-api-pagination-across-social-and-campus-public-position-feeds',
  extractionStrategy:
    'verified-official-social-and-campus-shells+public-social-and-campus-position-apis+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on July 17, 2026 that https://career.oppo.com/official/oppo and https://careers.oppo.com/university/oppo are the live first-party OPPO social and campus shells, and that the public job feeds are backed by https://career.oppo.com/ats-candidate-api/open-api/position/queryPositionList and https://careers.oppo.com/openapi/position/pageNew. The current official public feeds expose live jobs but no India-located matches were observed on the verified date, so this provider keeps the exact-name first-party surfaces integrated and filters to India-only locations.',
}

export default OPPO_CATALOG
