import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TRUMINDS_SOFTWARE_SYSTEMS_CATALOG = {
  source: 'trumindssoftwaresystems',
  companyName: 'Truminds Software Systems',
  officialBrandName: 'Truminds Software Systems Private Limited',
  adapter: 'script',
  homepageUrl: 'https://www.truminds.com/',
  companyCareerPage: 'https://www.truminds.com/en/careers',
  handoffBoardUrl: 'https://truminds.turbohire.co/careerpage/2b7541be-4b35-4cd3-8ba3-09173acb3de9',
  orgId: '2b7541be-4b35-4cd3-8ba3-09173acb3de9',
  atsPlatform: 'turbohire',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-page-handoff-plus-public-turbohire-api',
  extractionStrategy: 'verified-first-party-careers-page+turbohire-board+noauth-token+filteredjobs-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'truminds.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.truminds.com/en/careers was the live first-party Truminds careers page, that both the United States and India "View Job Positions" CTAs handed candidates to the public TurboHire board at https://truminds.turbohire.co/careerpage/2b7541be-4b35-4cd3-8ba3-09173acb3de9, and that the board title resolved as "Truminds Software Systems Private Limited". This local scraper follows the first-party careers handoff and the standard TurboHire public filteredjobs API contract.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'trumindssoftwaresystems/jobs.json',
}

export default TRUMINDS_SOFTWARE_SYSTEMS_CATALOG
