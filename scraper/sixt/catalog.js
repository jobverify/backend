import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SIXT_CATALOG = {
  source: 'sixt',
  companyName: 'Sixt',
  officialBrandName: 'SIXT',
  adapter: 'script',
  homepageUrl: 'https://www.sixt.jobs/in/about-us',
  companyCareerPage: 'https://www.sixt.jobs/in/jobs?q=&country=IN',
  officialCareersPageUrl: 'https://www.sixt.jobs/in/jobs?q=&country=IN',
  detailPagePrefix: 'https://www.sixt.jobs/in/jobs/',
  companyDomain: 'sixt.jobs',
  atsPlatform: 'first-party-careers-site',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-india-listing-page+first-party-detail-pages',
  extractionStrategy: 'verified-first-party-india-jobs-page+visible-job-links+first-party-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-27',
  verifiedSurfaceSummary:
    'Verified on Monday, July 27, 2026 against https://www.sixt.jobs/in/about-us and https://www.sixt.jobs/in/jobs?q=&country=IN. The first-party SIXT India jobs page exposed 9 public India roles through first-party detail pages, including Software Development Engineer III (Java Backend), Security Engineer II (AI), MLOps Engineer III, AI Data Engineer III, Senior Product Manager II (Salesforce), Staff Data Engineer, Engineering Manager (Salesforce), and Software Development Engineer II (Golang). Current detail pages still include stable first-party markers such as Apply now, YOUR ROLE AT SIXT, and YOUR SKILLS MATTER, but some live roles now use an About us section where older pages used What we offer.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default SIXT_CATALOG
