import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const WINJIT_TECHNOLOGIES_CATALOG = {
  source: 'winjittechnologies',
  companyName: 'Winjit Technologies',
  officialBrandName: 'Winjit',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  homepageUrl: 'https://www.winjit.com/',
  companyCareerPage: 'https://www.winjit.com/',
  atsPlatform: 'official-domain-blocked-by-sucuri',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-interstitial-validation-return-empty',
  extractionStrategy: 'verified-sucuri-interstitial+no-trustworthy-public-jobs-surface',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'winjit.com',
  dryRunFile: 'winjittechnologies/jobs.json',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.winjit.com/ returned a first-party Sucuri interstitial requiring JavaScript and did not expose a trustworthy public careers or jobs surface to scrape directly.',
}

export default WINJIT_TECHNOLOGIES_CATALOG
