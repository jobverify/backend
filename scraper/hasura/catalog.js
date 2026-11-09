import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Sunday, August 2, 2026 that https://hasura.io/careers/ redirects to the live first-party PromptQL careers page at https://promptql.io/careers, that the page hands job seekers to the live Gem board at https://jobs.gem.com/promptql, and that the Gem shell currently loads https://static.gem.com/scripts/jobBoards.BpHUFx-E.v2.min.js with tracking id 4a76acaa-70ac-4e16-bedb-d4426e6a9d3c. Verified that the public GraphQL endpoint at https://jobs.gem.com/api/public/graphql currently returns 5 public postings and 1 actionable India role after excluding the talent-community pool post: Forward Deployed Analyst, Bangalore with application route https://jobs.gem.com/promptql/am9icG9zdDqFcCqALL3yOrMp6tFzI6t8/application.'

export const HASURA_CATALOG = {
  source: 'hasura',
  companyName: 'Hasura',
  officialBrandName: 'PromptQL',
  adapter: 'script',
  dryRunFile: 'hasura/jobs.json',
  companyCareerPage: 'https://hasura.io/careers/',
  redirectedCareersPageUrl: 'https://promptql.io/careers',
  officialGemBoardUrl: 'https://jobs.gem.com/promptql',
  graphqlApiUrl: 'https://jobs.gem.com/api/public/graphql',
  gemBoardBundleUrl: 'https://static.gem.com/scripts/jobBoards.BpHUFx-E.v2.min.js',
  gemBoardTrackingId: '4a76acaa-70ac-4e16-bedb-d4426e6a9d3c',
  verifiedPublicPostingCount: 5,
  verifiedIndiaScopedPostingCount: 2,
  verifiedIndiaActionableRoleCount: 1,
  verifiedSampleJobUrl: 'https://jobs.gem.com/promptql/am9icG9zdDqFcCqALL3yOrMp6tFzI6t8',
  verifiedSampleApplyUrl:
    'https://jobs.gem.com/promptql/am9icG9zdDqFcCqALL3yOrMp6tFzI6t8/application',
  atsPlatform: 'gem',
  countryFilter: 'India',
  paginationStrategy: 'single-public-graphql-job-board-query',
  extractionStrategy:
    'verified-hasura-careers-redirect+verified-gem-board-shell+public-graphql-list-query+public-graphql-detail-query+india-location-filter+talent-community-exclusion',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'jobs.gem.com',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default HASURA_CATALOG
