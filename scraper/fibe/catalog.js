import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const FIBE_CATALOG = {
  source: 'fibe',
  companyName: 'Fibe',
  adapter: 'script',
  homepageUrl: 'https://www.fibe.in/',
  companyCareerPage: 'https://www.fibe.in/careers/',
  checkedJobsRouteUrl: 'https://www.fibe.in/jobs',
  companyDomain: 'fibe.in',
  atsPlatform: 'official-company-careers-empty-board',
  countryFilter: 'India',
  paginationStrategy: 'first-party-empty-careers-page-validation',
  extractionStrategy:
    'verified-fibe-homepage-careers-link+verified-empty-fibe-careers-page-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that the first-party Fibe homepage at https://www.fibe.in/ links its careers handoff to https://www.fibe.in/careers/, that the first-party careers page currently shows "No Jobs found", and that https://www.fibe.in/jobs resolves to a first-party 404 page. The trustworthy public surface is therefore an official empty careers board, not a live public jobs feed.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default FIBE_CATALOG
