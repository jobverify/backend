import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const WYZMINDZ_SOLUTIONS_CATALOG = {
  source: 'wyzmindzsolutions',
  companyName: 'Wyzmindz Solutions',
  officialBrandName: 'WyzMindz',
  adapter: 'script',
  homepageUrl: 'https://wyzmindz.com/',
  companyCareerPage: 'https://wyzmindz.com/',
  contactPageUrl: 'https://wyzmindz.com/contact/',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-contact-page-plus-common-route-404-validation',
  extractionStrategy: 'verified-wordpress-homepage+verified-contact-form+missing-common-career-routes-return-404',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'wyzmindz.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://wyzmindz.com/ remained the first-party WyzMindz WordPress marketing site, that https://wyzmindz.com/contact/ exposed the same Get in touch contact flow, and that common public careers routes returned first-party Page not found responses instead of structured jobs.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default WYZMINDZ_SOLUTIONS_CATALOG
