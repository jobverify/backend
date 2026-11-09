import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  "Verified September 13, 2026: the official careers page embeds a public jobs API with one role. Neither the role nor its detail supplies a country, so country remains unknown and this role is excluded from India publication."

export const SYSTECH_SOLUTIONS_CATALOG = {
  source: 'systechsolutions',
  companyName: 'Systech Solutions',
  officialBrandName: 'Systech Solutions',
  adapter: 'script',
  homepageUrl: 'https://systechusa.com/',
  companyCareerPage: 'https://systechusa.com/careers/',
  officialCareersPageUrl: 'https://systechusa.com/careers/',
  embeddedJobsListApiUrl:
    'https://prod-171.westus.logic.azure.com:443/workflows/67e48103c49d4bb78d575f18cebb36c1/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=0AvRedg1d2FnScRDeHgN_FJM9mUgKuZaInXLg5Fy_Lc',
  embeddedJobsDetailApiUrl:
    'https://prod-125.westus.logic.azure.com:443/workflows/9c049c250c2b4aed831092094d3c61f0/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=O_necFuH-pBhqeGk6KKpYwNEP1f0ax4lxGEPWbZ1kBA',
  usOpeningsPageUrl: 'https://systechusa.com/careers-us/',
  companyDomain: 'systechusa.com',
  atsPlatform: "first-party-careers-page-embedded-jobs-api",
  countryFilter: 'India',
  paginationStrategy: "single-first-party-careers-page-plus-embedded-jobs-api",
  extractionStrategy:
    "verified-first-party-careers-page+complete-embedded-jobs-api+explicit-country-validation",
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: "2026-09-13",
  verifiedPublicJobCount: 1,
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'systechsolutions/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SYSTECH_SOLUTIONS_CATALOG
