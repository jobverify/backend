import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that the official Fireflies.ai homepage at https://fireflies.ai/ ' +
  'hands careers traffic from https://fireflies.ai/careers to the live Gem board at ' +
  'https://jobs.gem.com/fireflies, that the current Gem board shell loads ' +
  'https://static.gem.com/scripts/jobBoards.BzUgVe52.v2.min.js with tracking id ' +
  '3eab0d5a-721b-4989-89f1-f95971c662ff, and that the public GraphQL endpoint at ' +
  'https://jobs.gem.com/api/public/graphql currently returns 8 public postings and 5 India roles. ' +
  'Verified India locations include Mumbai, Bengaluru, Chennai, and Pune, with the live sample role ' +
  'https://jobs.gem.com/fireflies/am9icG9zdDqXUtqNK-Y5LIdSxQYHLBn3 and its application route at ' +
  'https://jobs.gem.com/fireflies/am9icG9zdDqXUtqNK-Y5LIdSxQYHLBn3/application.'

export const FIREFLIES_AI_CATALOG = {
  source: 'firefliesai',
  companyName: 'Fireflies.ai',
  officialBrandName: 'Fireflies.ai',
  adapter: 'script',
  dryRunFile: 'firefliesai/jobs.json',
  homepageUrl: 'https://fireflies.ai/',
  officialHomepageUrl: 'https://fireflies.ai/',
  companyCareerPage: 'https://fireflies.ai/careers',
  officialGemBoardUrl: 'https://jobs.gem.com/fireflies',
  graphqlApiUrl: 'https://jobs.gem.com/api/public/graphql',
  gemBoardBundleUrl: 'https://static.gem.com/scripts/jobBoards.BzUgVe52.v2.min.js',
  gemBoardTrackingId: '3eab0d5a-721b-4989-89f1-f95971c662ff',
  verifiedPublicPostingCount: 8,
  verifiedIndiaRoleCount: 5,
  verifiedSampleJobUrl: 'https://jobs.gem.com/fireflies/am9icG9zdDqXUtqNK-Y5LIdSxQYHLBn3',
  verifiedSampleApplyUrl:
    'https://jobs.gem.com/fireflies/am9icG9zdDqXUtqNK-Y5LIdSxQYHLBn3/application',
  atsPlatform: 'gem',
  countryFilter: 'India',
  paginationStrategy: 'single-public-graphql-job-board-query',
  extractionStrategy:
    'verified-first-party-careers-redirect+verified-gem-board-shell+public-graphql-list-query+public-graphql-detail-query+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'jobs.gem.com',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  modulePath: path.join(currentDir, 'script.js'),
}

export default FIREFLIES_AI_CATALOG
