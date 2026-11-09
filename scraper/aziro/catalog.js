import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AZIRO_CATALOG = {
  source: 'aziro',
  companyName: 'Aziro',
  officialBrandName: 'Aziro',
  adapter: 'script',
  homepageUrl: 'https://www.aziro.com/',
  companyCareerPage: 'https://www.aziro.com/en/careers',
  companyDomain: 'aziro.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'Global',
  paginationStrategy: 'first-party-careers-table',
  extractionStrategy:
    'verified-first-party-nextjs-careers-page+current-openings-table-rows',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedPublicJobCount: 5,
  verifiedIndiaJobCount: 3,
  verifiedSampleJobUrl: 'https://www.aziro.com/en/careers',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026: https://www.aziro.com/en/careers resolved with the Aziro Careers title, the first-party note that Aziro is formerly MSys Technologies, and a visible Current Openings table that included Senior full stack engineer, Senior SDET Engineer, Senior QA Engineer, Lead CRM Specialist, and Senior Machine Learning Engineer with DevOps Expertise.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default AZIRO_CATALOG
