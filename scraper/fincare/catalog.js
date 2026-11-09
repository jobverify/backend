import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on August 14, 2026 that browser checks still resolve https://fincarebank.in/ and its exact-name careers routes to https://www.au.bank.in/, that direct Node fetches of https://www.au.bank.in/ and https://www.au.bank.in/au-small-finance-bank-and-fincare-small-finance-bank-merger currently receive the Cloudflare "Just a moment..." interstitial, and that local API-only resolution of the legacy exact-name fincarebank.in routes can fail with ENOTFOUND during runtime. The first-party AU migration page https://www.au.bank.in/au-small-finance-bank-and-fincare-small-finance-bank-merger remains the verified merger reference. There is no trustworthy public jobs surface for the exact-name Fincare brand anymore: the public exact-name domains now hand off to AU Small Finance Bank rather than to a Fincare-branded careers or jobs listing surface.'

export const FINCARE_CATALOG = {
  source: 'fincare',
  companyName: 'Fincare',
  officialBrandName: 'Fincare',
  adapter: 'script',
  homepageUrl: 'https://fincarebank.in/',
  companyCareerPage: 'https://fincarebank.in/careers',
  legacyWwwHomepageUrl: 'https://www.fincarebank.com/',
  mergedParentHomepageUrl: 'https://www.au.bank.in/',
  legacyMergerInfoUrl: 'https://www.au.bank.in/au-small-finance-bank-and-fincare-small-finance-bank-merger',
  checkedRedirectRouteUrls: [
    'https://fincarebank.in/',
    'https://fincarebank.in/careers',
    'https://fincarebank.in/jobs',
    'https://fincarebank.in/about-us/careers',
  ],
  companyDomain: 'fincarebank.in',
  atsPlatform: 'legacy-brand-redirect-to-au-bank-homepage',
  countryFilter: 'India',
  paginationStrategy: 'legacy-homepage-and-careers-route-redirect-validation',
  extractionStrategy:
    'verified-legacy-fincare-routes-redirect-to-au-homepage-without-public-jobs-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-14',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'fincare/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default FINCARE_CATALOG
