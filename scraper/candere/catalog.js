import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Rechecked the official https://candere.jobsoid.com/ board on 2026-10-23: its native server-rendered Current Openings section explicitly says No Current Openings. Each run fetches and validates the board identity and empty section before attaching verified-empty evidence. Fetch, identity and schema failures throw; newly advertised openings require verified native parsing and cannot be reported as zero.'

export const CANDERE_CATALOG = {
  source: 'candere',
  companyName: 'Candere',
  officialBrandName: 'Candere by Kalyan Jewellers',
  adapter: 'script',
  companyCareerPage: 'https://candere.jobsoid.com/',
  companyDomain: 'candere.com',
  atsPlatform: 'jobsoid',
  countryFilter: 'India',
  paginationStrategy: 'single-jobsoid-board-validation',
  extractionStrategy: 'live-native-jobsoid-board-identity-and-explicit-empty-validation',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-23',
  verifiedPublicJobCount: 0,
  verifiedIndiaJobCount: 0,
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'candere/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default CANDERE_CATALOG
