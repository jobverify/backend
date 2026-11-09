import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SMARTDATA_ENTERPRISES_CATALOG = {
  source: 'smartdataenterprises',
  companyName: 'smartData Enterprises',
  officialBrandName: 'smartData',
  adapter: 'script',
  companyCareerPage: 'https://www.smartdatainc.com/careers/',
  companyDomain: 'smartdatainc.com',
  atsPlatform: 'first-party-careers-inline-openings',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy: 'verified-awsm-job-listings+inline-descriptions+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.smartdatainc.com/careers/ was the live first-party smartData careers page and that it rendered inline AWSM job cards with first-party detail links and full descriptions. Live cards included Associate Software Developer – .NET (MS), Lead Java Developer, Senior Java Developer – Consultant, and Associates / Senior Associates – Business Development Group, with India city cues such as Mohali, Dehradun, and Nagpur visible in the public markup.',
  dryRunFile: 'smartdataenterprises/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SMARTDATA_ENTERPRISES_CATALOG
