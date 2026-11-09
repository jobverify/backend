import path from 'node:path'
import { fileURLToPath } from 'node:url'
const currentDir = path.dirname(fileURLToPath(import.meta.url))
const PROVIDER_METADATA = {
  source: 'flatgigs', companyName: 'Flatgigs', adapter: 'script', catalogOverride: true,
  modulePath: path.join(currentDir, 'script.js'), dryRunFile: path.join(currentDir, 'jobs.json'),
  companyCareerPage: 'https://flatgigs.com/career/', companyDomain: 'flatgigs.com',
  atsPlatform: 'workable-widget-v1', countryFilter: 'India', paginationStrategy: 'native-widget-location-variants-and-same-mode-closing-observations',
  extractionStrategy: 'official-publisher-account-observations-with-unqualified-company-scope', parser: 'custom-script', normalizationProfile: 'engineering-default',
  backfillMode: 'native-partial-observations', zeroResultPolicy: 'coverage-gap',
  verifiedOn: null, verifiedAt: null, verifiedPublicJobCount: null, verifiedIndiaJobCount: null, verifiedInventoryStatus: 'unverified',
  verifiedSurfaceSummary: 'Publisher-bound widget observations only; legal employers, reciprocal domain, authoritative company totals, current availability and lifecycle scope remain unknown. The retained native cohort lacks an actual sixth same-mode closing response.',
}
export default PROVIDER_METADATA
export { PROVIDER_METADATA }
