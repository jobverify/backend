import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const EVALUESERVE_CATALOG = {
  source: 'evalueserve',
  companyName: 'Evalueserve',
  officialBrandName: 'Evalueserve',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'evalueserve/jobs.json',
  homepageUrl: 'https://www.evalueserve.com/',
  companyCareerPage: 'https://www.evalueserve.com/careers/',
  jobsPageUrl: 'https://www.evalueserve.com/jobs/',
  darwinboxBaseUrl: 'https://lighthouse.darwinbox.com/',
  verifiedExampleJobUrl: 'https://lighthouse.darwinbox.com/ms/candidate/careers/a6a44d6b6ef79a',
  atsPlatform: 'first-party-jobs-page-plus-darwinbox-handoff',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-jobs-page-html',
  extractionStrategy:
    'verified-first-party-careers-page+verified-first-party-jobs-page+inline-job-cards+darwinbox-learn-more-links+india-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'evalueserve.com',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://www.evalueserve.com/careers/ is the live first-party careers page for Evalueserve, that it links candidates to the first-party jobs page at https://www.evalueserve.com/jobs/, and that the jobs page renders inline job cards with India filters and Darwinbox Learn More handoffs rooted at https://lighthouse.darwinbox.com/. Verified visible India roles including Senior Trainer — AI/ML & Analytics in Gurgaon and Consultant-Devops in Bangalore.',
}

export default EVALUESERVE_CATALOG
