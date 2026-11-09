import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const LEENA_AI_CATALOG = {
  source: 'leenaai',
  companyName: 'Leena AI',
  officialBrandName: 'Leena AI',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'leenaai/jobs.json',
  homepageUrl: 'https://leena.ai/',
  companyCareerPage: 'https://leena.ai/careers',
  openRolesTabUrl: 'https://leena.ai/careers?tab=explore-jobs',
  companyDomain: 'leena.ai',
  verifiedPublicJobCount: 14,
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-static-careers-bundle',
  extractionStrategy: 'verified-first-party-careers-page+static-careers-bundle-open-role-data',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-19',
  verifiedSurfaceSummary:
    'Verified on Sunday, July 19, 2026 that https://leena.ai/careers is the live first-party Leena AI careers page, that both https://leena.ai/careers and https://leena.ai/careers?tab=explore-jobs serve the same static page shell, and that the first-party careers-dc4b1af244aa93dd.js page bundle embeds 14 live India role entries with official PyjamaHR apply links, including Technical Program Manager in Gurgaon, India and AI Engineer in Gurgaon, India.',
}

export default LEENA_AI_CATALOG
