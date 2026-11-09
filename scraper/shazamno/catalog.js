import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SHAZAM_NO_CATALOG = {
  source: 'shazamno',
  companyName: 'Shazam? no',
  officialBrandName: 'Shazam',
  adapter: 'script',
  homepageUrl: 'https://www.shazam.com/en-us',
  companyCareerPage: 'https://www.shazam.com/en-us',
  appleCareersSearchUrl: 'https://jobs.apple.com/en-us/search?sort=relevance&search=shazam',
  exactRowClassification: 'noisy-backlog-row',
  companyDomain: 'shazam.com',
  atsPlatform: 'noisy-backlog-row-not-a-real-exact-name-company',
  countryFilter: 'India',
  paginationStrategy: 'first-party-brand-page-plus-apple-careers-handoff-validation',
  extractionStrategy:
    'verified-shazam-brand-page+verified-apple-careers-surface+exact-row-not-a-company-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-26',
  verifiedSurfaceSummary:
    'Verified on Sunday, July 26, 2026 that https://www.shazam.com/en-us remained the first-party Shazam music surface, that its footer carried the Apple Inc. and its affiliates ownership marker and handed careers traffic to Apple jobs under https://jobs.apple.com/en-us/search?sort=relevance&search=shazam, and that the Apple careers search surface still included a QA Lead - Shazam (12 Month Contract) role under Apple. No first-party page used the literal backlog text "Shazam? no", so that row is treated as a noisy note rather than a real exact-name company entry.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default SHAZAM_NO_CATALOG
