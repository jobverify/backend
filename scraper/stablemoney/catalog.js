import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const STABLE_MONEY_CATALOG = {
  source: 'stablemoney',
  companyName: 'Stable Money',
  adapter: 'script',
  companyCareerPage: 'https://stablemoney.in/',
  homepageUrl: 'https://stablemoney.in/',
  aboutUsUrl: 'https://stablemoney.in/about-us',
  contactUsUrl: 'https://stablemoney.in/contact-us',
  officialBrandName: 'Stable Money',
  legalEntityName: 'Stable Finserv Private Limited',
  platformEntityName: 'Stable-Alpha Technologies Private Limited',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'reachable-first-party-pages-plus-adjacent-no-jobs-route-validation',
  extractionStrategy:
    'verified-homepage-about-contact-pages+adjacent-first-party-careers-routes-no-public-jobs-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'stablemoney.in',
  verifiedOn: '2026-07-19',
  verifiedSurfaceSummary:
    'Verified on July 19, 2026 that https://stablemoney.in/, https://stablemoney.in/about-us, and https://stablemoney.in/contact-us were reachable trusted first-party Stable Money surfaces, with help@stablemoney.in plus the legal/platform entities Stable Finserv Private Limited and Stable-Alpha Technologies Pvt. Ltd. visible there. Adjacent exact-name first-party careers routes such as https://stablemoney.in/careers, https://stablemoney.in/career, https://stablemoney.in/jobs, https://stablemoney.in/join-us, https://stablemoney.in/work-with-us, and https://stablemoney.in/openings returned 404 shells and did not expose trustworthy public job links, so there is no trustworthy public jobs surface.',
  officialFirstPartyUrls: [
    'https://stablemoney.in/',
    'https://stablemoney.in/about-us',
    'https://stablemoney.in/contact-us',
  ],
  noPublicJobsRouteUrls: [
    'https://stablemoney.in/careers',
    'https://stablemoney.in/career',
    'https://stablemoney.in/jobs',
    'https://stablemoney.in/join-us',
    'https://stablemoney.in/work-with-us',
    'https://stablemoney.in/openings',
  ],
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default STABLE_MONEY_CATALOG
