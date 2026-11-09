import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MOTIVITYLABS_CATALOG = {
  source: 'motivitylabs',
  companyName: 'MotivityLabs',
  officialBrandName: 'Motivity Labs',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'motivitylabs/jobs.json',
  companyCareerPage: 'https://motivitylabs.com/careers/',
  officialCareersPageUrl: 'https://motivitylabs.com/jobs/',
  companyDomain: 'motivitylabs.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'complete-public-jobs-api-count-reconciled',
  extractionStrategy: 'verified-first-party-client+public-jobs-api+expiry-and-confirmed-india+incomplete-geography-preservation',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-09',
  verifiedSurfaceSummary:
    "Verified on October 9, 2026 that the official Motivity Labs careers and jobs pages load their public GET jobs API through the current first-party client. The complete API count reconciled 26 published roles: 17 with confirmed India geography and 9 with unverified location. Only confirmed India roles are returned, with full API descriptions, expiry filtering and incomplete source scope so previous vacancies are preserved.",
}

export default MOTIVITYLABS_CATALOG
