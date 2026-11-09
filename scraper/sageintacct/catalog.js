import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, August 14, 2026 that https://www.sage.com/en-us/sage-business-cloud/intacct/, the shared Sage careers hub at https://www.sage.com/en-us/company/careers/, the public search shell at https://www.sage.com/en-us/company/careers/career-search/, and the Sage locations page at https://www.sage.com/en-us/company/careers/locations/ are all blocked in this environment by the same Cloudflare 403 interstitial. Because Sage Intacct is presented on the trusted first-party Sage surface as a product brand rather than a separate exact-name public jobs board, and the directly fetched public Sage pages are currently blocked by the same Cloudflare 403 interstitial, no trustworthy exact-name public jobs surface for Sage Intacct or Sage Intacct India is reachable from this environment, so this provider remains a fail-closed sentinel that returns no jobs.'

export const SAGE_INTACCT_CATALOG = {
  source: 'sageintacct',
  companyName: 'Sage Intacct',
  officialBrandName: 'Sage Intacct',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'sageintacct/jobs.json',
  officialBrandSiteUrl: 'https://www.sage.com/en-us/sage-business-cloud/intacct/',
  companyCareerPage: 'https://www.sage.com/en-us/company/careers/',
  officialSearchPageUrl: 'https://www.sage.com/en-us/company/careers/career-search/',
  indiaLocationsPageUrl: 'https://www.sage.com/en-us/company/careers/locations/',
  companyDomain: 'sage.com',
  atsPlatform: 'sage-shared-careers-hub-sentinel',
  countryFilter: 'India',
  paginationStrategy: 'shared-sage-careers-hub-without-exact-brand-job-surface',
  extractionStrategy:
    'verified-sage-intacct-product-page+browser-verified-sage-careers-hub+verified-india-locations-no-exact-brand-job-surface-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-14',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default SAGE_INTACCT_CATALOG
