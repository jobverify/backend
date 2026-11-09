import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TECHWAVE_CONSULTING_CATALOG = {
  source: 'techwaveconsulting',
  companyName: 'Techwave Consulting',
  officialBrandName: 'Techwave',
  adapter: 'script',
  companyCareerPage: 'https://www.techwave.com/career/',
  officialCareersPageUrl: 'https://www.techwave.com/career/',
  joinUsPageUrl: 'https://www.techwave.com/join-us/',
  officialWorkdayBoardUrl: 'https://techwave.wd108.myworkdayjobs.com/TechWave_Careers',
  jobsApiUrl: 'https://techwave.wd108.myworkdayjobs.com/wday/cxs/techwave/TechWave_Careers/jobs',
  verifiedIndiaLocationDescriptors: [
    'Bangalore',
    'GDC Financial District',
    'GDC HiTech',
    'Khammam',
  ],
  companyDomain: 'techwave.com',
  atsPlatform: 'workday-jobs-api',
  countryFilter: 'India',
  paginationStrategy: 'first-party-workday-jobs-api',
  extractionStrategy: 'verified-first-party-careers-shell+verified-join-us-workday-embed+public-workday-board+india-location-facets+jobs-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-14',
  verifiedPublicJobCount: 63,
  verifiedIndiaJobCount: 37,
  verifiedSurfaceSummary:
    'Verified on Friday, August 14, 2026 that https://www.techwave.com/career/ remained the live first-party Techwave careers shell titled "Techwave Careers: Empowering Your Success", but that its public role handoff now routes through the first-party page https://www.techwave.com/join-us/ rather than linking straight to Workday. Verified that https://www.techwave.com/join-us/ is the live first-party Join Us page titled "Join Us - TechWave" and that it embeds the public Workday board https://techwave.wd108.myworkdayjobs.com/TechWave_Careers in an iframe. Verified that the Workday jobs API at https://techwave.wd108.myworkdayjobs.com/wday/cxs/techwave/TechWave_Careers/jobs still exposed India location facets including Bangalore, GDC Financial District, GDC HiTech, and Khammam, with 63 public jobs overall and 37 India jobs including AI Architect, Sr. Data Architect (Databricks), Service Delivery Manager – AI/ML and Data, Cloud Network Architect, and Product Designer.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'techwaveconsulting/jobs.json',
}

export default TECHWAVE_CONSULTING_CATALOG
