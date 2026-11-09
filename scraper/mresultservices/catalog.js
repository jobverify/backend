import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MRESULT_SERVICES_CATALOG = {
  source: 'mresultservices',
  companyName: 'MResult Services',
  officialBrandName: 'MResult',
  adapter: 'script',
  homepageUrl: 'https://mresult.com/',
  companyCareerPage: 'https://mresult.com/careers/',
  officialCareersPageUrl: 'https://mresult.com/careers/',
  contactPageUrl: 'https://mresult.com/contact-us/',
  companyDomain: 'mresult.com',
  atsPlatform: 'first-party-careers-page-no-public-jobs-inventory',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-careers-plus-contact-page-validation',
  extractionStrategy:
    'verified-homepage+verified-careers-page+verified-contact-page+no-trustworthy-public-jobs-inventory-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedPublicJobCount: 0,
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://mresult.com/ was the live exact-name MResult homepage, that https://mresult.com/careers/ was the first-party careers page carrying culture copy including "View Current Job Openings" but no trustworthy public jobs inventory, and that https://mresult.com/contact-us/ still exposed the Bangalore and Mangalore India offices. This provider therefore stays fail-closed until a trustworthy public jobs inventory appears on the first-party surface.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'mresultservices/jobs.json',
}

export default MRESULT_SERVICES_CATALOG
