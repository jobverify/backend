import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://deepintent.com/ is the live official DeepIntent homepage and that its top-level Careers navigation points to https://deepintent.com/careers. Verified that https://deepintent.com/careers is the current first-party careers page, that it prominently exposes Open Positions messaging, but that no public job cards, same-domain job detail routes, or external ATS handoffs were visible on the verified page. The verified careers page currently functions as a culture-and-benefits shell only, so there is no trustworthy public jobs surface for DeepIntent on the verified date.'

export const DEEP_INTENT_CATALOG = {
  source: 'deepintent',
  companyName: 'DeepIntent',
  adapter: 'script',
  homepageUrl: 'https://deepintent.com/',
  companyCareerPage: 'https://deepintent.com/careers',
  companyDomain: 'deepintent.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-careers-link-plus-first-party-open-positions-shell-without-public-job-links',
  extractionStrategy:
    'verified-homepage+verified-careers-page+verified-open-positions-shell-without-public-job-links-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'deepintent/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default DEEP_INTENT_CATALOG
