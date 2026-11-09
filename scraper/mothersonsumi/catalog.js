import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Thursday, July 16, 2026 that https://www.motherson.com/people/careers-and-internships is the official first-party careers page for the Motherson brand and links candidates to the public careers surface at https://careers.motherson.com/en/jobs?country=India. The public first-party jobs page exposes embedded Next.js job data and showed 24 India jobs on Thursday, July 16, 2026, with a verified sample public detail page at https://careers.motherson.com/en/job/assistant-manager-paintshop-5510.'

export const MOTHERSON_SUMI_CATALOG = {
  source: 'mothersonsumi',
  companyName: 'Motherson Sumi',
  officialBrandName: 'Motherson',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'mothersonsumi/jobs.json',
  homepageUrl: 'https://www.motherson.com/',
  companyCareerPage: 'https://www.motherson.com/people/careers-and-internships',
  companyDomain: 'motherson.com',
  handoffBoardUrl: 'https://careers.motherson.com/en/jobs?country=India',
  verifiedSampleJobUrl: 'https://careers.motherson.com/en/job/assistant-manager-paintshop-5510',
  atsPlatform: 'official-company-careers+successfactors-apply',
  countryFilter: 'India',
  paginationStrategy: 'first-party-nextjs-embedded-job-index-plus-public-detail-pages',
  extractionStrategy:
    'verified-first-party-careers-page+verified-motherson-jobs-index+embedded-nextjs-job-data+india-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default MOTHERSON_SUMI_CATALOG
