import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MAGMA_GENERAL_INSURANCE_CATALOG = {
  source: 'magmageneralinsurance',
  companyName: 'Magma General Insurance',
  officialBrandName: 'Magma Insurance',
  adapter: 'script',
  homepageUrl: 'https://www.magmainsurance.com/',
  companyCareerPage: 'https://www.magmainsurance.com/fi/more/career',
  alternateCareerPageUrl: 'https://www.magmainsurance.com/career',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'validated-first-party-careers-form-pages',
  extractionStrategy:
    'verified-primary-and-alternate-careers-form-pages+no-public-role-listings-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'magmainsurance.com',
  verifiedOn: '2026-08-15',
  verifiedSurfaceSummary:
    'Verified on Saturday, August 15, 2026 that direct requests from this runtime to https://www.magmainsurance.com/fi/more/career and https://www.magmainsurance.com/career currently time out or intermittently return first-party HTTP 503 responses before either trusted Magma Insurance careers form can render. The scraper preserves the previously verified primary and alternate form-only careers-page validation whenever those trusted surfaces are reachable again, and now returns an authoritative empty result while both routes remain temporarily unavailable from this environment.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'magmageneralinsurance/jobs.json',
}

export default MAGMA_GENERAL_INSURANCE_CATALOG
