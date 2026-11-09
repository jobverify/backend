import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  source: 'allucent', companyName: 'Allucent', adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'), dryRunFile: path.join(currentDir, 'jobs.json'),
  companyCareerPage: 'https://www.allucent.com/careers', officialHomepageUrl: 'https://www.allucent.com/',
  companyDomain: 'allucent.com', boardToken: 'allucent',
  workableBoardUrl: 'https://apply.workable.com/allucent/',
  workableAccountUid: '7e3163b7-6595-472a-8fb6-7424218ed72b', boardIdentityVerified: true,
  atsPlatform: 'workable-native-api', countryFilter: 'India',
  paginationStrategy: 'workable-nextPage-cursor-with-total-and-unique-identity-reconciliation',
  extractionStrategy: 'verified-corporate-careers-handoff+unfiltered-workable-v3-cursor-inventory+explicit-country-lists+matching-v2-full-details',
  parser: 'workable-public-cursor-api', normalizationProfile: 'engineering-default',
  backfillMode: 'live-parser', zeroResultPolicy: 'evidence-required',
  remediationStatus: 'live-extraction-and-production-visibility-verified',
  verifiedOn: '2026-10-20', verifiedAt: null, verifiedPublicJobCount: 32, verifiedIndiaJobCount: 1,
  verifiedInventoryStatus: 'complete-inventory',
  verifiedSurfaceSummary: 'On October 20, 2026, the native Workable API reconciled 32 unique roles across four cursor pages and returned one explicit Bengaluru role with matching full details. The unchanged extraction passed isolated real MongoDB persistence and the public visibility query, then a targeted live upsert verified the job publicly. Evidence is under artifacts/full-catalog/allucent-live-rollout/. Future runs fetch and validate fresh inventory; this historical snapshot never establishes a current count or an empty inventory.',
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
