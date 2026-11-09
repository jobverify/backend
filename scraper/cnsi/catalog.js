import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CNSI_CATALOG = {
  source: 'cnsi',
  companyName: 'CNSI',
  officialBrandName: 'CNSI',
  adapter: 'script',
  companyCareerPage: 'https://www.cnsi.com/',
  legacyHomepageUrl: 'http://www.cns-inc.com/',
  companyDomain: 'cnsi.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'official-domains-unreachable-validation',
  extractionStrategy: 'verified-official-domains-unreachable-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 via first-party live probes that https://www.cnsi.com/ and the legacy official domain http://www.cns-inc.com/ did not yield a trustworthy current first-party public jobs surface. No trustworthy current first-party public jobs surface was confirmed, so this company stays fail-closed and returns an empty set until the official domains are re-verified.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'cnsi/jobs.json',
}

export default CNSI_CATALOG
