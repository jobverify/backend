import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PARENTLANE_CATALOG = {
  source: 'parentlane',
  companyName: 'Parentlane',
  officialBrandName: 'Parentlane',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'parentlane/jobs.json',
  homepageUrl: 'https://www.parentlane.com/',
  companyCareerPage: 'https://www.parentlane.com/aboutus.html',
  verifiedMissingCareersRouteUrl: 'https://www.parentlane.com/careers',
  officialSupportEmail: 'info@parentlane.com',
  companyDomain: 'parentlane.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-and-about-page-plus-missing-careers-route',
  extractionStrategy:
    'verified-first-party-homepage+about-page+404-careers-route+self-signed-tls-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.parentlane.com/ and https://www.parentlane.com/aboutus.html are the live exact-name first-party Parentlane pages, that https://www.parentlane.com/careers currently returns a 404 Not Found surface, and that standard Node HTTPS fetches against the exact-name Parentlane domain currently fail with a self-signed certificate error. There is no trustworthy public jobs surface on the exact-name Parentlane domain, so this provider is pinned as a fail-closed sentinel that returns no jobs until Parentlane publishes a trustworthy first-party public jobs surface.',
}

export default PARENTLANE_CATALOG
