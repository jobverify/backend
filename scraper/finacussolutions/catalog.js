import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const FINACUS_SOLUTIONS_CATALOG = {
  source: 'finacussolutions',
  companyName: 'Finacus Solutions',
  officialBrandName: 'Finacus Solutions Private Limited',
  adapter: 'script',
  homepageUrl: 'https://www.finacus.co.in/',
  companyCareerPage: 'https://www.finacus.co.in/careers/',
  companyDomain: 'finacus.co.in',
  atsPlatform: 'official-company-careers-page',
  countryFilter: 'India',
  paginationStrategy: 'stable-current-visible-cards-global-total-unavailable',
  extractionStrategy: 'current-public-GET-details+original-native-models+unknown-country-without-own-country-field+incomplete-source-scope',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: null,
  verifiedPublicJobCount: null,
  verifiedIndiaJobCount: null,
  verifiedSurfaceSummary:
    'Current first-party public card and full detail extraction. Native global total is unavailable; inventory remains partial and runtime counts are not stored in metadata.',
  dryRunFile: 'finacussolutions/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default FINACUS_SOLUTIONS_CATALOG
