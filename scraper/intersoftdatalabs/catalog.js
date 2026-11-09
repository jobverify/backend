import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const INTERSOFT_DATA_LABS_CATALOG = {
  source: 'intersoftdatalabs',
  companyName: 'Intersoft Data Labs',
  officialBrandName: 'Intersoft Data Labs',
  adapter: 'script',
  companyCareerPage: 'https://intsof.com/careers/',
  companyDomain: 'intsof.com',
  atsPlatform: 'official-company-site-inline-openings-email-handoff',
  countryFilter: 'India',
  paginationStrategy: 'single-careers-page-toggle-openings',
  extractionStrategy: 'verified-first-party-careers-page+toggle-job-openings+resume-email-handoff',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://intsof.com/careers/ is the live first-party careers page for Intersoft Data Labs, that it exposes Current Openings through page-local toggle sections including Data Modeler and Core .NET Dev / Sr. Dev., and that each opening hands resumes to career@intsof.com with the shared location label India Development Centre.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'intersoftdatalabs/jobs.json',
}

export default INTERSOFT_DATA_LABS_CATALOG
