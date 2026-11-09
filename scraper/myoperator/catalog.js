import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MYOPERATOR_CATALOG = {
  source: 'myoperator',
  companyName: 'MyOperator',
  officialBrandName: 'MyOperator',
  adapter: 'script',
  companyCareerPage: 'https://myoperator.com/careers',
  officialCareersPageUrl: 'https://myoperator.com/careers',
  externalHandoffUrl: 'https://careers.myoperator.com/jobs/Careers',
  jobsApiUrl: 'https://careers.myoperator.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  companyDomain: 'myoperator.com',
  atsPlatform: 'zoho-recruit',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-shell-plus-public-zoho-recruit-json',
  extractionStrategy: 'verified-first-party-careers-shell+public-zoho-recruit-jobs-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://myoperator.com/careers is the live first-party MyOperator careers shell, that it hands applicants to the first-party Zoho Recruit portal at https://careers.myoperator.com/jobs/Careers, and that the public Zoho Recruit API at https://careers.myoperator.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite returned live roles including Vice President - Strategic Alliances & Partnerships, Senior Site Reliability Engineer, Business Consultant, and Software Developer – Python with India locations such as Noida.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'myoperator/jobs.json',
}

export default MYOPERATOR_CATALOG
