import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 18, 2026 that the exact-name first-party LiquidHub root https://www.liquidhub.com/ now redirects to the generic Capgemini homepage at https://www.capgemini.com/. There is no trustworthy public jobs surface on the exact-name LiquidHub domain: no exact-name careers surface or exact-name public job listings were verifiable on the current first-party domain, so this provider remains a fail-closed sentinel that returns an empty set until a trustworthy exact-name careers surface reappears.'

export const LIQUIDHUB_CATALOG = {
  source: 'liquidhub',
  companyName: 'LiquidHub',
  officialBrandName: 'LiquidHub',
  adapter: 'script',
  companyCareerPage: 'https://www.liquidhub.com/',
  redirectedHomepageUrl: 'https://www.capgemini.com/',
  companyDomain: 'liquidhub.com',
  atsPlatform: 'exact-name-domain-redirect-no-public-jobs',
  countryFilter: 'India',
  paginationStrategy: 'verified-exact-name-root-redirect-validation',
  extractionStrategy:
    'verified-exact-name-root-redirect-to-capgemini+no-public-jobs-on-exact-name-domain-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'liquidhub/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default LIQUIDHUB_CATALOG
