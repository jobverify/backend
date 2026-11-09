import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const BUILDKITE_CATALOG = {
  source: 'buildkite',
  companyName: 'Buildkite',
  officialBrandName: 'Buildkite',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'buildkite/jobs.json',
  companyCareerPage: 'https://buildkite.com/about/careers/',
  greenhouseBoardUrl: 'https://job-boards.greenhouse.io/buildkite',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/buildkite/jobs',
  companyDomain: 'buildkite.com',
  verifiedPublicJobCount: null,
  verifiedIndiaJobCount: null,
  zeroResultPolicy: 'evidence-required',
  sourceScopeComplete: false,
  sourceCompanyWideScopeComplete: false,
  lifecycleCleanupAllowed: false,
  configuredBoardProofRequiresLiveEvidence: true,
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'complete-native-feed-and-office-index;all-own-details-opening-closing;final-native-feed-after-details',
  extractionStrategy: 'active-public-inventory-program+original-native-models+explicit-own-JD-workplace-country-proof',
  parser: 'bound-current-public-greenhouse-board',
  normalizationProfile: 'engineering-default',
  verifiedOn: null,
  verifiedSurfaceSummary:
    'Runtime binds the active public Astro inventory renderer to the complete declared Buildkite Greenhouse board, retains every original native vacancy and full public description, checks office membership and explicit own-role work-country restrictions, and reads the final native inventory after closing details. ANZ, global and timezone-only places remain unresolved without a role-owned country restriction. Configured-board totals require fresh complete live proof; company totals and cleanup remain unverified.',
}

export default BUILDKITE_CATALOG
