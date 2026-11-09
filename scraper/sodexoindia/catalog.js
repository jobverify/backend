import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SODEXO_INDIA_CATALOG = {
  source: 'sodexoindia',
  companyName: 'Sodexo India',
  officialBrandName: 'Sodexo India',
  adapter: 'script',
  companyCareerPage: 'https://www.sodexo.in/careers',
  officialHomepageUrl: 'https://www.sodexo.in/',
  accessHrJobsUrl: 'https://accesshr.in.sodexo.com/#/jobs',
  companyDomain: 'sodexo.in',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-careers-page-plus-accesshr-login-js-shell-or-timeout-validation',
  extractionStrategy:
    'verified-first-party-careers-page+verified-accesshr-jobs-link+verified-login-shell-js-shell-or-timeout-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-27',
  verifiedSurfaceSummary:
    'Verified on Monday, July 27, 2026 that https://www.sodexo.in/careers is the live Sodexo India careers page and its raw first-party HTML links candidates to https://accesshr.in.sodexo.com/#/jobs. The linked AccessHr surface on https://accesshr.in.sodexo.com/ now responds as a JavaScript app shell titled AccessHr with the same first-party base href and app-root bootstrap, while still exposing no trustworthy public jobs listing in fetched HTML; timeout-only probes remain acceptable fallback behavior for this non-public surface.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SODEXO_INDIA_CATALOG
