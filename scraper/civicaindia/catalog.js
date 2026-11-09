import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CIVICA_INDIA_CATALOG = {
  source: 'civicaindia',
  companyName: 'Civica India',
  officialBrandName: 'Civica',
  adapter: 'script',
  companyCareerPage: 'https://www.civica.com/en-in/about-us/careers/',
  workablePageUrl: 'https://apply.workable.com/civica-uk-ltd-1/',
  nativeAccountUrl: 'https://apply.workable.com/api/v1/accounts/civica-uk-ltd-1',
  companyDomain: 'civica.com',
  atsPlatform: 'workable-native-api',
  countryFilter: 'India',
  paginationStrategy: 'unfiltered-native-cursor-total-and-closing-snapshot-reconciliation',
  extractionStrategy: 'current-regional-corporate-handoff+exact-native-account-and-website+full-published-india-details',
  zeroResultPolicy: 'evidence-required',
  backfillMode: 'live-parser',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-26',
  verifiedSurfaceSummary:
    'Verified October 26, 2026: the current Civica India corporate careers page links Our vacancies to the exact civica-uk-ltd-1 Workable board. Native account UID 8433007d-b16d-4cd7-bd7d-a8cd3a8ebff3 identifies brand Civica and the reciprocal https://www.civica.com/en-gb/ route. Runtime verifies fresh corporate/account bindings, every unfiltered cursor page and complete published India detail, then a closing snapshot. Native country codes and dates are preserved. Challenges, hidden evidence, changed roles and unresolved additional hiring scope cannot certify complete inventory.',
  dryRunFile: 'civicaindia/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default CIVICA_INDIA_CATALOG
