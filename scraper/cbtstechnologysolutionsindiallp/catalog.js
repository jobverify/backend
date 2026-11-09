import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CBTS_TECHNOLOGY_SOLUTIONS_INDIA_LLP_CATALOG = {
  source: 'cbtstechnologysolutionsindiallp',
  companyName: 'CBTS TECHNOLOGY SOLUTIONS INDIA LLP',
  officialBrandName: 'CBTS India',
  adapter: 'script',
  homepageUrl: 'https://www.cbts.com/',
  companyCareerPage: 'https://www.cbts.com/careers',
  ripplingBoardUrl: 'https://ats.rippling.com/cbtsindia/jobs',
  ripplingBoardSlug: 'cbtsindia',
  atsPlatform: "eightfold",
  countryFilter: 'India',
  paginationStrategy: "first-party-careers-page-plus-eightfold-offset-limit",
  extractionStrategy: "verified-first-party-careers-page+linked-eightfold-board-api+india-location-filter",
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'cbts.com',
  verifiedOn: "2026-10-03",
  verifiedSurfaceSummary:
    "Verified on October 3, 2026 that https://www.cbts.com/careers links its CBTS India opportunities to https://jobs.cbts.com/careers?&location=India. The CBTS-branded Eightfold board identifies domain cbts.com and its public /api/pcsx/search API reports 23 positions. Structured India locations, including the country-only IN label, identify 22 India jobs; one record has no verifiable location and is excluded. Public position_details responses expose descriptions and application links on jobs.cbts.com. The legacy Rippling board is retained for older first-party handoffs.",
  modulePath: path.join(currentDir, 'script.js'),
}

export default CBTS_TECHNOLOGY_SOLUTIONS_INDIA_LLP_CATALOG
