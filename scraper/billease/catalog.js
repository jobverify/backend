import path from 'node:path'
import { fileURLToPath } from 'node:url'
const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const BILLEASE_CATALOG = {
  source: 'billease', companyName: 'BillEase', officialBrandName: 'BillEase', adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'), dryRunFile: 'billease/jobs.json',
  homepageUrl: 'https://billease.ph/', companyCareerPage: 'https://billease.ph/careers/', companyDomain: 'billease.ph',
  atsPlatform: 'manatal-careers-page', countryFilter: 'India',
  paginationStrategy: 'all-public-manatal-pages+closing-native-and-corporate-reconciliation',
  extractionStrategy: 'visible-corporate-role-binding+native-country+full-role-details',
  backfillMode: 'live-parser', zeroResultPolicy: 'evidence-required', parser: 'custom-script', normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-26', verifiedPublicJobCount: null, verifiedIndiaJobCount: null,
  verifiedSurfaceSummary: 'Current corporate role links bind the BillEase Manatal tenant and its reciprocal company website. Runtime reads the advertised Nuxt payload and every native page, validates explicit India role details and application identity, then reconciles closing corporate/native inventories. Missing native countries are not filled from corporate presentation defaults. Mismatched inventories, unresolved scope or caps stay partial and cannot authorize cleanup; publication dates remain unknown unless native evidence exists.',
}
export default BILLEASE_CATALOG
