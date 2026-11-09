import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CREATIVELIPI_WEBTECH_CATALOG = {
  source: 'creativelipiwebtech',
  companyName: 'Creativelipi Webtech',
  officialBrandName: 'Creative Lipi',
  adapter: 'script',
  homepageUrl: 'https://creativelipi.com/',
  companyCareerPage: 'https://creativelipi.com/contact-us/',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-contact-page-plus-page-sitemap-validation',
  extractionStrategy:
    'verified-homepage+verified-contact-page+verified-page-sitemap-without-careers-route+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'creativelipi.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://creativelipi.com/ was the live exact-name first-party Creative Lipi homepage, that https://creativelipi.com/contact-us/ was the published first-party contact route, and that https://creativelipi.com/page-sitemap.xml listed contact-us but no public careers, jobs, join-us, or work-with-us route. No trustworthy public first-party jobs surface was exposed for Creativelipi Webtech on the verified date, so this provider stays fail-closed.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'creativelipiwebtech/jobs.json',
}

export default CREATIVELIPI_WEBTECH_CATALOG
