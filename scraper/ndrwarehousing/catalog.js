import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Thursday, July 16, 2026 that https://www.ndrwarehousing.com/ is the live official NDR Warehousing homepage, that https://www.ndrwarehousing.com/contact.html is the official first-party contact page, and that the common first-party careers routes https://www.ndrwarehousing.com/careers, https://www.ndrwarehousing.com/career, https://www.ndrwarehousing.com/jobs, and https://www.ndrwarehousing.com/join-us returned 404 responses during live checks. No trustworthy public jobs surface was exposed on the official first-party domain.'

export const NDR_WAREHOUSING_CATALOG = {
  source: 'ndrwarehousing',
  companyName: 'NDR Warehousing',
  officialBrandName: 'NDR Warehousing',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'ndrwarehousing/jobs.json',
  companyCareerPage: 'https://www.ndrwarehousing.com/',
  companyDomain: 'ndrwarehousing.com',
  officialHomepageUrl: 'https://www.ndrwarehousing.com/',
  officialContactPageUrl: 'https://www.ndrwarehousing.com/contact.html',
  noPublicCareersRouteUrls: [
    'https://www.ndrwarehousing.com/careers',
    'https://www.ndrwarehousing.com/career',
    'https://www.ndrwarehousing.com/jobs',
    'https://www.ndrwarehousing.com/join-us',
  ],
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-contact-and-common-careers-route-404-validation',
  extractionStrategy: 'verified-homepage+verified-contact+verified-missing-careers-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default NDR_WAREHOUSING_CATALOG
