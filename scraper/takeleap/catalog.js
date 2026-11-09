import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TAKE_LEAP_CATALOG = {
  source: 'takeleap',
  companyName: 'TakeLeap',
  adapter: 'script',
  companyCareerPage: 'https://takeleap.com/',
  homepageUrl: 'https://takeleap.com/',
  aboutUsUrl: 'https://takeleap.com/about-us',
  contactUsUrl: 'https://takeleap.com/contact/',
  officialBrandName: 'TAKELEAP',
  legalEntityName: 'TAKELEAP DMCC',
  businessEmail: 'digital@takeleap.com',
  indiaContactEmail: 'gm.india@takeleap.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'exact-name-first-party-route-timeout-validation',
  extractionStrategy:
    'verified-first-party-homepage-plus-about-and-contact-pages+exact-name-first-party-routes-timeout-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'takeleap.com',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://takeleap.com/, https://takeleap.com/about-us, and https://takeleap.com/contact/ were the trusted first-party TAKELEAP brochure and contact surfaces, carrying TAKELEAP brand copy plus digital@takeleap.com and gm.india@takeleap.com contact markers. Those verified pages exposed quick links such as About us, Services, Enterprise Solutions, Blog, Contact us, and Sitemap, but no trustworthy public careers or jobs surface. Direct probes to those pages and adjacent exact-name first-party careers routes such as https://takeleap.com/careers, https://takeleap.com/career, https://takeleap.com/jobs, https://takeleap.com/join-us, https://takeleap.com/work-with-us, and https://takeleap.com/openings timed out, so there was no trustworthy public jobs surface on Friday, July 17, 2026.',
  firstPartyTimeoutUrls: [
    'https://takeleap.com/',
    'https://takeleap.com/about-us',
    'https://takeleap.com/contact/',
    'https://takeleap.com/careers',
    'https://takeleap.com/career',
    'https://takeleap.com/jobs',
    'https://takeleap.com/join-us',
    'https://takeleap.com/work-with-us',
    'https://takeleap.com/openings',
  ],
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default TAKE_LEAP_CATALOG
