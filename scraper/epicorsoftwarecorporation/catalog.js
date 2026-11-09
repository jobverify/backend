import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const EPICOR_SOFTWARE_CORPORATION_CATALOG = {
  source: 'epicorsoftwarecorporation',
  companyName: 'Epicor Software Corporation',
  officialBrandName: 'Epicor',
  adapter: 'script',
  companyCareerPage: 'https://www.epicor.com/en/jobs/',
  officialWorkdayBoardUrl: 'https://epicorsoftware.wd5.myworkdayjobs.com/epicorjobs',
  jobsApiUrl: 'https://epicorsoftware.wd5.myworkdayjobs.com/wday/cxs/epicorsoftware/epicorjobs/jobs',
  verifiedIndiaLocationDescriptors: [
    'India',
    'Bangalore',
    'Hyderabad',
    'Remote',
  ],
  companyDomain: 'epicor.com',
  atsPlatform: 'workday-jobs-api',
  countryFilter: 'India',
  paginationStrategy: 'first-party-workday-jobs-api',
  extractionStrategy: 'verified-first-party-jobs-shell+public-workday-board+india-job-filter+jobs-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.epicor.com/en/jobs/ is the live first-party Epicor jobs shell, that it hands applicants to the public Workday board at https://epicorsoftware.wd5.myworkdayjobs.com/epicorjobs, and that the public board advertises India hiring through the Epicor-managed careers flow.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'epicorsoftwarecorporation/jobs.json',
}

export default EPICOR_SOFTWARE_CORPORATION_CATALOG
