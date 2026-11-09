import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Thursday, July 16, 2026 that the exact-name first-party MPL domain https://www.mpl.live/ resolved to a consumer gaming homepage titled "Play Games on MPL" with compliance copy about deposits and no cash games. Common careers routes including /careers, /career, /jobs, /join-us, /work-with-us, and /about-us/careers returned 404, so there was no trustworthy public jobs surface or ATS handoff to extract.'

export const MPL_CATALOG = {
  source: 'mpl',
  companyName: 'MPL',
  officialBrandName: 'Mobile Premier League (MPL)',
  adapter: 'script',
  homepageUrl: 'https://www.mpl.live/',
  companyCareerPage: 'https://www.mpl.live/',
  companyDomain: 'mpl.live',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-validation',
  extractionStrategy: 'verified-exact-name-homepage-without-public-jobs-surface-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'mpl/jobs.json',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default MPL_CATALOG
