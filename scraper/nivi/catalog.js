import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const NIVI_CATALOG = {
  source: 'nivi',
  companyName: 'NIVI',
  officialBrandName: 'Nivi',
  adapter: 'script',
  homepageUrl: 'https://nivi.io/',
  companyCareerPage: 'https://nivi.io/careers',
  companyDomain: 'nivi.io',
  officialAboutUrl: 'https://nivi.io/about',
  clientBundleUrl: 'https://nivi.io/assets/index-tmZUd8-T.js',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-shell-plus-client-bundle-careers-route-validation',
  extractionStrategy:
    'verified-homepage-shell+verified-about-page-cta+verified-client-bundle-no-open-positions-route-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-21',
  verifiedSurfaceSummary:
    'Verified on Friday, August 21, 2026 that https://nivi.io/ is the live first-party Nivi site, https://nivi.io/about contains the official "Join Our Team" call-to-action to https://nivi.io/careers, and the verified client bundle at https://nivi.io/assets/index-tmZUd8-T.js defines the first-party /careers route with the message "No Open Positions" rather than trustworthy public job listings.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'nivi/jobs.json',
}

export default NIVI_CATALOG
