import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 16, 2026 that https://www.giva.co/ is the live first-party homepage for GIVA and that its Quick links section includes a Join Us link to the careers shell at https://www.giva.co/pages/careers. Verified that the careers page is still a first-party brand shell containing Why GIVA?, Hear from the #GemsofGIVA, and Indiejewel Fashions Private Limited, but does not expose trustworthy public job cards, ATS links, or structured JobPosting markup. The scraper therefore returns an empty array until a real public jobs surface appears.'

export const GIVA_CATALOG = {
  source: 'giva',
  companyName: 'GIVA',
  officialBrandName: 'GIVA Jewellery',
  adapter: 'script',
  homepageUrl: 'https://www.giva.co/',
  companyCareerPage: 'https://www.giva.co/pages/careers',
  companyDomain: 'giva.co',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-careers-shell-validation',
  extractionStrategy:
    'verified-homepage+verified-careers-shell-without-public-listings-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'giva/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default GIVA_CATALOG
