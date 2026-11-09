import path from 'node:path'
import { fileURLToPath } from 'node:url'
const currentDir = path.dirname(fileURLToPath(import.meta.url))
const PROVIDER_METADATA = {
  source: 'wati', companyName: 'WATI', adapter: 'script', modulePath: path.join(currentDir, 'script.js'),
  companyCareerPage: 'https://www.wati.io/career/', companyDomain: 'wati.io',
  atsPlatform: 'workable-native-api', boardToken: 'wati-dot-i-o', accountUid: 'da70e071-85cc-431f-b985-66f433ef6d33',
  paginationStrategy: 'native-v3-unfiltered-cursor-with-reconciled-total',
  extractionStrategy: 'verified-workable-account+native-india-countries+identity-validated-v2-details',
  verifiedOn: '2026-10-23',
  verifiedSurfaceSummary: 'Official WATI careers links directly to apply.workable.com/wati-dot-i-o/. The native account identifies WATI.io, wati.io and the configured account UID. Observed unfiltered six-page native inventory contains 57 public roles with 17 India roles, each matched to a native detail response. Every run enumerates current native inventory and checks its total and terminal cursor.',
  bindingEvidence: { verified: true, checkedAt: '2026-10-23', firstPartyUrl: 'https://www.wati.io/career/',
    matchedLinks: ['https://apply.workable.com/wati-dot-i-o/'], evidenceFile: 'scraper/wati/fixtures/metadata.json' },
  dryRunFile: path.join(currentDir, 'jobs.json'), backfillMode: 'live-parser', zeroResultPolicy: 'evidence-required',
  countryFilter: 'India', originalAdapter: 'script', originalAtsPlatform: 'verified-public-careers-non-listing-surface',
  originalModulePath: '../workbookbatch05/wati.js', originalDryRunFile: null,
}
export default PROVIDER_METADATA
export { PROVIDER_METADATA }
