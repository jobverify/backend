import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const STRATOGENT_TECHNOLOGY_SERVICES_CATALOG = {
  source: 'stratogenttechnologyservices',
  companyName: 'Stratogent Technology Services',
  officialBrandName: 'Stratogent',
  adapter: 'script',
  homepageUrl: 'https://www.stratogent.com/',
  companyCareerPage: 'https://www.stratogent.com/careers/',
  companyDomain: 'stratogent.com',
  atsPlatform: 'official-company-careers-no-public-jobs',
  countryFilter: 'India',
  paginationStrategy: 'single-email-only-careers-page',
  extractionStrategy:
    'verified-first-party-careers-page+always-hiring-email-copy+no-public-job-cards-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-05',
  verifiedSurfaceSummary:
    'Verified on Wednesday, August 5, 2026 that https://www.stratogent.com/careers/ redirects to the live first-party PTP India careers page at https://ptp.cloud/careers/india/. The live page says Opportunities at PTP / Stratogent: Build trusted life sciences cloud from India, still describes the team as always hiring, and instructs applicants to email careers-india@stratogent.com. The current surface exposes no trustworthy public job cards, detail pages, or ATS listings for the exact Stratogent row, so this provider fails closed and returns an empty result.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'stratogenttechnologyservices/jobs.json',
}

export default STRATOGENT_TECHNOLOGY_SERVICES_CATALOG
