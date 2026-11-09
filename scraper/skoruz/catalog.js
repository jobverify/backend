import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SKORUZ_CATALOG = {
  source: 'skoruz',
  companyName: 'Skoruz',
  officialBrandName: 'Skoruz Technologies Pvt Ltd',
  adapter: 'script',
  homepageUrl: 'https://www.skoruz.com/',
  companyCareerPage: 'https://www.skoruz.com/careers/',
  embeddedIndiaJobsUrl: 'https://talenthire.ceipal.in/Jobs/listing/MTAz',
  companyDomain: 'skoruz.com',
  atsPlatform: 'official-careers-page-with-public-us-postings-and-untrusted-ceipal-embed',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page+visible-us-postings+india-ceipal-timeout-sentinel',
  extractionStrategy: 'verified-careers-page+extract-public-us-postings+india-untrusted-iframe-fallback',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary:
    'Verified on Tuesday, August 4, 2026 against https://www.skoruz.com/careers/. The official Skoruz careers page still embeds India openings via https://talenthire.ceipal.in/Jobs/listing/MTAz, but a clean client timed out reaching that CEIPAL board. The United States section now publicly lists a first-party posting dated August 1, 2026 for Network and Computer Systems Administrator in San Jose, CA, with applications directed to hr@skoruz.com. The scraper captures visible first-party public postings and treats the India iframe as a monitored but currently untrusted public surface.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default SKORUZ_CATALOG
