import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PICKRR_CATALOG = {
  source: 'pickrr',
  companyName: 'Pickrr',
  officialBrandName: 'Pickrr',
  adapter: 'script',
  homepageUrl: 'https://pickrr.com/',
  companyCareerPage: 'https://pickrr.com/life-at-pickrr/',
  companyDomain: 'pickrr.com',
  officialSitemapUrl: 'https://pickrr.com/sitemap.xml',
  official404CareersUrl: 'https://pickrr.com/careers',
  atsPlatform: 'official-company-careers-form-no-public-jobs',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-sitemap-plus-life-page-validation',
  extractionStrategy:
    'verified-timeout-only-first-party-routes+legacy-homepage-life-at-pickrr-sitemap-and-careers-404-fallback-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-13',
  verifiedSurfaceSummary:
    'Verified on Thursday, August 13, 2026 that https://pickrr.com/, https://pickrr.com/sitemap.xml, https://pickrr.com/life-at-pickrr/, and https://pickrr.com/careers each currently fail with repeated connect timeouts, so no trustworthy public jobs surface is reachable on the first-party Pickrr domain from this environment. The scraper still tolerates the previously verified homepage, life-at-pickrr form page, sitemap, and careers not-found fallback when those legacy surfaces reappear without public job listings.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'pickrr/jobs.json',
}

export default PICKRR_CATALOG
