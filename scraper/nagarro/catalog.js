import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const NAGARRO_CATALOG = {
  source: 'nagarro',
  companyName: 'Nagarro',
  officialBrandName: 'Nagarro',
  adapter: 'script',
  homepageUrl: 'https://www.nagarro.com/en/careers',
  companyCareerPage: 'https://www.nagarro.com/en/careers/job-search',
  careersLandingPageUrl: 'https://www.nagarro.com/en/careers',
  smartRecruitersBoardUrl: 'https://careers.smartrecruiters.com/Nagarro1',
  smartRecruitersListingApiUrl: 'https://api.smartrecruiters.com/v1/companies/Nagarro1/postings',
  smartRecruitersDetailApiUrlTemplate:
    'https://api.smartrecruiters.com/v1/companies/Nagarro1/postings/{{jobId}}',
  companyDomain: 'nagarro.com',
  atsPlatform: 'smartrecruiters',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-pages-plus-smartrecruiters-api',
  extractionStrategy: 'official-careers-pages+smartrecruiters-jobs-api+detail-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on Thursday, July 16, 2026 that https://www.nagarro.com/en/careers is the official Nagarro careers landing page, that https://www.nagarro.com/en/careers/job-search is the live first-party public job-search surface, and that the job-search page includes a direct SmartRecruiters application handoff under Nagarro1. Verified that the public ATS board at https://careers.smartrecruiters.com/Nagarro1 exposes India location buckets including Bengaluru, India and Remote, India, and that the live SmartRecruiters India listings API at https://api.smartrecruiters.com/v1/companies/Nagarro1/postings returned India postings on the verified date. Nagarro should be integrated as a real SmartRecruiters-backed provider rather than a sentinel.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default NAGARRO_CATALOG
