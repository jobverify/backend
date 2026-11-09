import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Revalidated on Saturday, August 1, 2026 that https://www.telstra.com.au/careers is the live first-party Telstra careers page now serving the Careers at Telstra shell with the hero Define Your Possible at Telstra and still linking Find a career to the public Workday board at https://telstra.wd3.myworkdayjobs.com/Telstra_Careers. Reconfirmed that the public Workday jobs API at https://telstra.wd3.myworkdayjobs.com/wday/cxs/telstra/Telstra_Careers/jobs remains live and still returns current India openings including Customer Service Consultant - International Voice Process in Bengaluru, Karnataka.'

export const TELSTRA_CATALOG = {
  source: 'telstra',
  companyName: 'Telstra',
  officialBrandName: 'Telstra',
  adapter: 'script',
  companyCareerPage: 'https://www.telstra.com.au/careers',
  officialCareersPageUrl: 'https://www.telstra.com.au/careers',
  officialWorkdayBoardUrl: 'https://telstra.wd3.myworkdayjobs.com/Telstra_Careers',
  jobsApiUrl: 'https://telstra.wd3.myworkdayjobs.com/wday/cxs/telstra/Telstra_Careers/jobs',
  companyDomain: 'telstra.com.au',
  atsPlatform: 'workday',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-handoff-plus-workday-jobs-api-country-facet',
  extractionStrategy: 'verified-first-party-careers-page+verified-workday-handoff+workday-jobs-api+india-country-facet',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-01',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'telstra.workday/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default TELSTRA_CATALOG
