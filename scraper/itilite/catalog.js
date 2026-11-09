import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ITILITE_CATALOG = {
  source: 'itilite',
  companyName: 'Itilite',
  officialBrandName: 'ITILITE',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  companyCareerPage: 'https://www.itilite.com/in/careers',
  globalCareersPage: 'https://www.itilite.com/careers',
  atsPlatform: 'first-party-careers-page-with-linkedin-handoff',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy: 'verified-first-party-india-careers-page+inline-job-cards+linkedin-apply-handoff',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'itilite.com',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that https://www.itilite.com/careers is the live global first-party careers page for ITILITE, that https://www.itilite.com/in/careers is the live India careers page, and that the India page exposes public first-party role cards with LinkedIn apply handoffs including Account Executive - US Sales via https://www.linkedin.com/jobs/view/4110847363, Lead Software Engineer via https://www.linkedin.com/jobs/view/3880037975, and Associate Travel Support in Bangalore. The verified first-party India page is a trustworthy public jobs surface.',
  dryRunFile: 'itilite/jobs.json',
}

export default ITILITE_CATALOG
