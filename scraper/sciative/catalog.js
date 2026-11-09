import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Sunday, July 26, 2026 that https://sciative.com/careers is the live first-party Sciative careers page with the title "Explore Exciting Careers and Growth Opportunities | Sciative", and that it loads the public first-party careers API at https://sciative.com/backend/get_career_item/1. The live API returned 21 public roles for this exact-name provider, including Business Manager: Hospitality (RMS & Dynamic Pricing), Devops Engineer, and Product Manager - Hospality Domain, all on the verified first-party surface.'

export const SCIATIVE_SOLUTIONS_CATALOG = {
  source: 'sciative',
  companyName: 'Sciative Solutions',
  officialBrandName: 'Sciative',
  adapter: 'script',
  homepageUrl: 'https://sciative.com/',
  companyCareerPage: 'https://sciative.com/careers',
  careersApiUrl: 'https://sciative.com/backend/get_career_item/1',
  companyDomain: 'sciative.com',
  atsPlatform: 'first-party-careers-page-plus-json-api',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-plus-public-json-endpoint',
  extractionStrategy: 'verified-first-party-careers-page+verified-first-party-careers-api+same-page-apply-flow',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-26',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'sciative/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SCIATIVE_SOLUTIONS_CATALOG
