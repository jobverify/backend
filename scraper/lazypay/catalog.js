import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 16, 2026 that https://lazypay.in/about-us is the live first-party LazyPay about page, that it identifies LazyPay as part of PayU and references PayU Finance India Private Limited, and that common exact-name careers routes https://www.lazypay.in/careers, https://www.lazypay.in/jobs, https://www.lazypay.in/join-us, and https://www.lazypay.in/work-with-us returned first-party 404 responses that resolved to https://www.lazypay.in/404 during verification. PayU public hiring surfaces were separately reachable at https://corporate.payu.in/careers/ and https://careers.payu.in/PayU/go/_/514880/, but there is no trustworthy public jobs surface on the exact-name LazyPay domain.'

export const LAZYPAY_CATALOG = {
  source: 'lazypay',
  companyName: 'LazyPay',
  officialBrandName: 'LazyPay Private Limited',
  adapter: 'script',
  homepageUrl: 'https://www.lazypay.in/',
  companyCareerPage: 'https://lazypay.in/about-us',
  aboutPageUrl: 'https://lazypay.in/about-us',
  parentCareersUrl: 'https://corporate.payu.in/careers/',
  parentJobBoardUrl: 'https://careers.payu.in/PayU/go/_/514880/',
  companyDomain: 'lazypay.in',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-about-page-plus-payu-brand-affiliation-plus-common-route-404-validation',
  extractionStrategy: 'verified-first-party-about-page+verified-payu-brand-affiliation+verified-missing-common-job-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'lazypay/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default LAZYPAY_CATALOG
