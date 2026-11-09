import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ORDERHIVE_CATALOG = {
  source: 'orderhive',
  companyName: 'Orderhive',
  officialBrandName: 'Orderhive',
  adapter: 'script',
  homepageUrl: 'https://orderhive.com/',
  companyCareerPage: 'https://orderhive.com/careers',
  parentHomepageUrl: 'https://www.cin7.com/',
  parentCareersPage: 'https://www.cin7.com/careers/',
  companyDomain: 'orderhive.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'exact-name-homepage-redirect-plus-generic-parent-careers-plus-missing-careers-route',
  extractionStrategy:
    'verified-orderhive-homepage-redirect+verified-generic-cin7-careers-without-orderhive-jobs+verified-missing-orderhive-careers-route-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-25',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 25, 2026 that https://orderhive.com/ and https://www.orderhive.com/ resolve to the generic Cin7 marketing site at https://www.cin7.com/, that https://orderhive.com/careers returns a first-party 404, and that https://www.cin7.com/careers/ is only the generic parent Cin7 careers page. There is no trustworthy public jobs surface for the exact-name Orderhive brand because the verified exact-name domain no longer exposes Orderhive-specific public openings.',
  dryRunFile: 'orderhive/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default ORDERHIVE_CATALOG
