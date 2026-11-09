import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const REAL_TIME_DATA_SERVICES_CATALOG = {
  source: 'realtimedataservices',
  companyName: 'Real Time Data Services',
  officialBrandName: 'Real Time Data Services',
  adapter: 'script',
  homepageUrl: 'https://myrealdata.in/',
  companyCareerPage: 'https://myrealdata.in/careers/',
  applyFormUrl: 'https://myrealdata.in/careers/apply-online/',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy: 'verified-first-party-careers-page+inline-json-position-payloads',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'myrealdata.in',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://myrealdata.in/careers/ was the live first-party Real Time Data Services careers page, that it exposed public inline position payloads for departments including Software Development, and that the verified Software Development card listed Senior Software Engineer, Lead Software Development Engineer(React Native), and Software Developer II in Gurugram, Haryana with the shared apply route at https://myrealdata.in/careers/apply-online/.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'realtimedataservices/jobs.json',
}

export default REAL_TIME_DATA_SERVICES_CATALOG
