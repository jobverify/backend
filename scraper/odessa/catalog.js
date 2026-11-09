import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ODESSA_CATALOG = {
  source: 'odessa',
  companyName: 'Odessa',
  officialBrandName: 'Odessa',
  adapter: 'script',
  homepageUrl: 'https://www.odessainc.com/',
  companyCareerPage: 'https://www.odessainc.com/careers/',
  jobsApiUrl: 'https://www.odessainc.com/wp-content/themes/odessa/components/jobs.php',
  companyDomain: 'odessainc.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-careers-page-plus-credential-blocked-first-party-jobs-endpoint',
  extractionStrategy:
    'verified-first-party-careers-page+verified-first-party-jobs-endpoint-returns-invalid-credentials+fail-closed-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedPublicJobCount: 0,
  verifiedIndiaJobCount: 0,
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026: https://www.odessainc.com/careers/ resolved with the public Odessa careers title and first-party Darwinbox careers script, while https://www.odessainc.com/wp-content/themes/odessa/components/jobs.php returned {"error":"Darwinbox API returned HTTP 401","raw":"{\\"status\\":0,\\"message\\":\\"Invalid Credentials\\"}"}. Because the exact-name first-party jobs feed is credential-blocked, this local provider fails closed and returns [].',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default ODESSA_CATALOG
