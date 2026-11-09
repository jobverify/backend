import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Thursday, July 16, 2026 that https://www.livguard.com/ is the live first-party Livguard homepage, that https://www.livguard.com/about-us is the official about page, and that the common first-party careers routes https://www.livguard.com/careers, https://www.livguard.com/career, https://www.livguard.com/jobs, https://www.livguard.com/join-us, and https://www.livguard.com/openings returned 404 responses during live checks. No trustworthy public jobs surface was exposed on the official first-party domain.'

export const LIVGUARD_CATALOG = {
  source: 'livguard',
  companyName: 'Livguard',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'livguard/jobs.json',
  companyCareerPage: 'https://www.livguard.com/',
  companyDomain: 'livguard.com',
  officialHomepageUrl: 'https://www.livguard.com/',
  officialAboutUrl: 'https://www.livguard.com/about-us',
  noPublicCareersRouteUrls: [
    'https://www.livguard.com/careers',
    'https://www.livguard.com/career',
    'https://www.livguard.com/jobs',
    'https://www.livguard.com/join-us',
    'https://www.livguard.com/openings',
  ],
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-about-and-common-careers-route-404-validation',
  extractionStrategy: 'verified-homepage+verified-about+verified-missing-careers-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default LIVGUARD_CATALOG
