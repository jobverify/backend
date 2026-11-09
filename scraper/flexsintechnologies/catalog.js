import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const FLEXSIN_TECHNOLOGIES_CATALOG = {
  source: 'flexsintechnologies',
  companyName: 'Flexsin Technologies',
  officialBrandName: 'Flexsin',
  adapter: 'script',
  homepageUrl: 'https://www.flexsin.com/',
  companyCareerPage: 'https://www.flexsin.com/careers/',
  atsPlatform: 'official-first-party-job-listings',
  countryFilter: 'India',
  paginationStrategy: 'single-page',
  extractionStrategy: 'verified-first-party-inline-job-cards',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'flexsin.com',
  verifiedOn: "2026-09-13",
  verifiedSurfaceSummary:
    "Verified September 13, 2026: the official Flexsin careers page publishes 37 role cards, including 36 with verified India locations and one without a role location. All cards are retained for validation and an incomplete snapshot flag prevents expiration of previous jobs while location scope remains unknown.",
  dryRunFile: 'flexsintechnologies/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default FLEXSIN_TECHNOLOGIES_CATALOG
