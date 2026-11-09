import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, July 17, 2026 that https://paynearby.in/careers-learning/ is the live official PayNearby careers page and that its visible Current job openings section currently exposes only an Open Position button to https://www.linkedin.com/company/paynearby/. The page source still contains old commented-out job-postings plugin markup, but no live first-party role cards, public ATS handoff, or other trustworthy public jobs surface is currently exposed. No trustworthy public jobs surface is available on the verified date.'

export const PAYNEARBY_CATALOG = {
  source: 'paynearby',
  companyName: 'PayNearby',
  officialBrandName: 'PayNearby',
  adapter: 'script',
  homepageUrl: 'https://paynearby.in/',
  companyCareerPage: 'https://paynearby.in/careers-learning/',
  officialLinkedInCompanyUrl: 'https://www.linkedin.com/company/paynearby/',
  companyDomain: 'paynearby.in',
  atsPlatform: 'official-company-site-linkedin-company-handoff-no-public-jobs-board',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-page-validation-only',
  extractionStrategy: 'verified-first-party-careers-page+linkedin-company-profile-handoff-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'paynearby/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default PAYNEARBY_CATALOG
