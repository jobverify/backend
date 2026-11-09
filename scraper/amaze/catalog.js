import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AMAZE_CATALOG = {
  source: 'amaze',
  companyName: 'Amaze',
  officialBrandName: 'Amaze',
  adapter: 'script',
  companyCareerPage: 'https://www.amaze.co/',
  companyDomain: 'amaze.co',
  aboutPageUrl: 'https://www.amaze.co/about-us',
  contactPageUrl: 'https://www.amaze.co/contact',
  brokenCareersHandoffUrl: 'https://jobs.lever.co/amaze',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy:
    'verified-homepage-plus-supporting-pages-plus-broken-careers-handoff-route-validation',
  extractionStrategy:
    'verified-homepage+verified-about-and-contact-pages+dead-footer-careers-link+404-first-party-careers-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://amaze.co/ redirects to the live official site at https://www.amaze.co/, and that the official homepage, https://www.amaze.co/about-us, and https://www.amaze.co/contact each expose the same footer Careers link to https://jobs.lever.co/amaze. That public careers handoff currently returns a Lever 404 page, while https://amaze.co/careers and https://amaze.co/jobs both resolve to first-party Not Found pages. No trustworthy public jobs surface was available for Amaze.',
  dryRunFile: 'amaze/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default AMAZE_CATALOG
