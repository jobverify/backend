import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const LICIOUS_CATALOG = {
  source: 'licious',
  companyName: 'Licious',
  officialBrandName: 'Licious',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'licious/jobs.json',
  companyCareerPage: 'https://www.licious.in/careers',
  officialCareersHandoffUrl: 'https://www.licious.in/careers/jobs',
  publicPortalUrl: 'https://licious.mynexthire.com/employer/jobs/careers',
  nativeListingApiUrl: 'https://licious.mynexthire.com/employer/careers/reqlist/get',
  companyDomain: 'licious.in',
  atsPlatform: 'mynexthire',
  countryFilter: 'India',
  paginationStrategy: 'full-unfiltered-native-array-and-closing-reconciliation',
  extractionStrategy: 'current-corporate-client+reciprocal-native-tenant+full-published-details-and-date-history',
  backfillMode: 'live-parser',
  zeroResultPolicy: 'evidence-required',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-26',
  verifiedSurfaceSummary:
    'Verified October 26, 2026: current corporate jobs component delegates to the Licious MyNextHire tenant (1163), whose website and configured job/application routes point back to www.licious.in. Runtime reads the full unfiltered native array and every published detail, preserves full descriptions and native publication history, verifies assigned India offices, and reconciles closing inventory. Ambiguous NCR and conflicting business identity remain unresolved; a footer-only iframe page cannot establish an empty board.',
}

export default LICIOUS_CATALOG
