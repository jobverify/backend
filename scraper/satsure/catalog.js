import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SATSURE_CATALOG = {
  source: 'satsure',
  companyName: 'SatSure',
  officialBrandName: 'SatSure Analytics India Pvt Ltd',
  adapter: 'script',
  companyCareerPage: 'https://www.satsure.co/careers/',
  officialCareersPageUrl: 'https://www.satsure.co/careers/',
  officialCareersHandoffUrl: 'https://satsure.keka.com/careers',
  jobsBoardUrl: 'https://satsure.keka.com/careers',
  careerPortalInfoUrl: 'https://satsure.keka.com/careers/api/organization/default/careerportalinfo',
  activeJobsUrl: 'https://satsure.keka.com/careers/api/embedjobs/default/active/350ad025-b87c-4c10-940f-8f95377d5133',
  verifiedSampleJobUrl: 'https://satsure.keka.com/careers/jobdetails/153475',
  companyDomain: 'satsure.co',
  atsPlatform: 'keka-embed-api',
  countryFilter: 'India',
  paginationStrategy: 'first-party-careers-page-handoff-plus-single-keka-active-jobs-endpoint',
  extractionStrategy:
    'verified-first-party-careers-page+verified-keka-handoff+embedded-khConfig+careerportalinfo+active-keka-embed-api+jobdetails+applyjob',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary:
    'Verified on Tuesday, August 4, 2026 that https://www.satsure.co/careers/ is the live first-party SatSure careers page, that it hands candidates to the public Keka board at https://satsure.keka.com/careers, and that the public active feed at https://satsure.keka.com/careers/api/embedjobs/default/active/350ad025-b87c-4c10-940f-8f95377d5133 exposes 25 live public openings including Software Development Engineer - 2, Machine Learning Engineer - 2, and AI Product Lead. The current public board resolves to the exact company identity SatSure Analytics India, and the live feed is now trustworthy enough to scrape directly.',
  dryRunFile: 'satsure/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SATSURE_CATALOG
