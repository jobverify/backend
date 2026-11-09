import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const RIVIGO_CATALOG = {
  source: 'rivigo',
  companyName: 'Rivigo',
  officialBrandName: 'Rivigo',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  homepageUrl: 'https://mahindralogistics.com/b2b-express/',
  legacyHomepageUrl: 'https://www.rivigo.com/',
  redirectedHomepageUrl: 'https://mahindralogistics.com/b2b-express/',
  companyCareerPage: 'https://mahindralogistics.com/work-with-us/',
  officialFirstPartyJobsUrl: 'https://nectar.darwinbox.in/ms/candidate/careers',
  atsPlatform: 'verified-brand-redirect-with-parent-company-darwinbox-handoff',
  countryFilter: 'India',
  paginationStrategy: 'fail-closed-sentinel',
  extractionStrategy: 'verified-brand-redirect+parent-company-careers-handoff+no-exact-company-public-jobs-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'rivigo.com',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary:
    'Verified on Tuesday, August 4, 2026 that the live Rivigo brand landing page is https://mahindralogistics.com/b2b-express/ and that the legacy https://www.rivigo.com/ domain now points candidates toward that Mahindra Logistics B2B Express surface instead of the obsolete Flexiele board at https://careers-rivigo.flexiele.com/. Verified that the parent careers page at https://mahindralogistics.com/work-with-us/ now hands applicants to https://nectar.darwinbox.in/ms/candidate/careers, whose public title is "Mahindra Logistics and Subsidiaries". Because the reviewed handoff is a parent-company and subsidiaries board rather than an exact-company Rivigo jobs surface, this company-local scraper stays fail-closed and returns no jobs until a trustworthy Rivigo-specific public openings flow is verified.',
  dryRunFile: 'rivigo/jobs.json',
}

export default RIVIGO_CATALOG
