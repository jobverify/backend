import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SIFY_TECHNOLOGIES_CATALOG = {
  source: 'sifytechnologies',
  companyName: 'Sify Technologies',
  officialBrandName: 'Sify Technologies',
  adapter: 'script',
  homepageUrl: 'https://www.sifytechnologies.com/',
  officialAboutPageUrl: 'https://www.sifytechnologies.com/about-us/',
  companyCareerPage: 'https://sifycareer.tallite.com/',
  officialJobsPageUrl: 'https://sifycareer.tallite.com/jobs',
  companyDomain: 'sifytechnologies.com',
  atsPlatform: 'tallite',
  countryFilter: 'India',
  paginationStrategy: 'encrypted-post-body-page-number',
  extractionStrategy:
    'verified-about-page-careers-link+public-tallite-encrypted-job-list+public-tallite-encrypted-job-detail',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-26',
  sellerShortCode: 'SIF',
  apiBaseUrl: 'https://www.tallite.com/api_sify/',
  listingApiUrl: 'https://www.tallite.com/api_sify/icrweb/home/tallite_career_portal_job_list?lngId=1&sellerShortCode=SIF',
  detailApiUrl: 'https://www.tallite.com/api_sify/icrweb/home/tallite_career_portal_job_detail?lngId=1&sellerShortCode=SIF',
  verifiedSurfaceSummary:
    'Verified on Sunday, July 26, 2026 that https://www.sifytechnologies.com/about-us/ still exposes first-party Careers links to both https://sifycareer.tallite.com/ and https://sifycareer.tallite.com/jobs while retaining the official "Driving Business Transformation Across Industries" and "India’s only organically grown ICT company" about-page copy. The public jobs surface continues to resolve to https://sifycareer.tallite.com/jobs and returned 36 India jobs, including Assistant Manager-Network Projects in Navi mumbai. Public encrypted Tallite APIs at https://www.tallite.com/api_sify/icrweb/home/tallite_career_portal_job_list?lngId=1&sellerShortCode=SIF and https://www.tallite.com/api_sify/icrweb/home/tallite_career_portal_job_detail?lngId=1&sellerShortCode=SIF still return live India job data through the frontend-exposed encryption contract.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'sifytechnologies/jobs.json',
}

export default SIFY_TECHNOLOGIES_CATALOG
