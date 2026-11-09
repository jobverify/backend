import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const BGD_TECH_PVT_LTD_CATALOG = {
  source: 'bgdtechpvtltd',
  companyName: 'BGD Tech PVT LTD',
  officialBrandName: 'BGD - Tech private limited',
  adapter: 'script',
  homepageUrl: 'https://bgd-limited.com/',
  companyCareerPage: 'https://bgd-limited.com/careers',
  atsPlatform: 'official-company-site-resume-intake-no-public-jobs',
  countryFilter: 'India',
  paginationStrategy: 'single-page',
  extractionStrategy: 'verified-careers-intake-page-without-public-listings-or-403-forbidden-surface',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'bgd-limited.com',
  verifiedOn: '2026-08-07',
  verifiedPublicJobCount: 0,
  verifiedIndiaJobCount: 0,
  verifiedSurfaceSummary:
    'Verified on Friday, August 7, 2026 that direct requests to the official BGD host currently resolve only to blocked edge pages (403 Forbidden and 404 Page Not Found variants) instead of a trustworthy public careers surface. The previously verified first-party careers page had exposed only a resume-intake surface with hello@bgd-limited.com and no trustworthy public listings, and the current blocked surface likewise exposes no public jobs.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default BGD_TECH_PVT_LTD_CATALOG
