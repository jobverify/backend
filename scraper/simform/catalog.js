import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SIMFORM_CATALOG = {
  source: 'simform',
  companyName: 'Simform',
  officialBrandName: 'Simform',
  adapter: 'script',
  officialCareersPageUrl: 'https://www.simform.com/careers/',
  companyCareerPage: 'https://www.simform.com/current-openings/',
  atsPlatform: 'kula-empty-board-sentinel',
  countryFilter: 'India',
  paginationStrategy: 'verified-current-openings-empty-state',
  extractionStrategy:
    'verified-current-openings-page+verified-empty-state+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'simform.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.simform.com/current-openings/ is the live first-party jobs surface and that it rendered the empty-state markers No jobs found matching your criteria and Load More Jobs on the current Kula board shell, so the local provider stays fail-closed until trustworthy public jobs appear again.',
  dryRunFile: 'simform/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SIMFORM_CATALOG
