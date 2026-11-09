import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const JIOSAAVN_CATALOG = {
  source: 'jiosaavn',
  companyName: 'JioSaavn',
  adapter: 'script',
  dryRunFile: 'jiosaavn/jobs.json',
  homepageUrl: 'https://corporate.saavn.com/',
  companyCareerPage: 'https://corporate.saavn.com/careers',
  companyDomain: 'corporate.saavn.com',
  atsPlatform: 'official-company-careers-empty-board',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-empty-board-validation',
  extractionStrategy:
    'verified-first-party-careers-page+verified-find-your-gig-zero-openings-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on Thursday, July 16, 2026 that the official JioSaavn careers page at https://corporate.saavn.com/careers is the current first-party public jobs surface and currently shows Find Your Gig location blocks for Mumbai, Bengaluru, Gurgaon, New York City, and Mountain View, CA with 0 Openings in each case.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default JIOSAAVN_CATALOG
