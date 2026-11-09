import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const MOEVING_CATALOG = {
  source: 'moeving',
  companyName: 'MoEVing',
  officialBrandName: 'MoEVing',
  exactCompanyMatchOnly: true,
  adapter: 'script',
  modulePath: path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'script.js'),
  dryRunFile: 'moeving/jobs.json',
  companyCareerPage: 'https://moeving.freshteam.com/jobs',
  officialCareersPageUrl: 'https://moeving.freshteam.com/jobs',
  companyDomain: 'moeving.com',
  atsPlatform: 'Freshteam official ATS (unverified current inventory)',
  countryFilter: 'India',
  paginationStrategy: 'unverified-native-inventory',
  extractionStrategy: 'bounded-native-check-rejects-unverified-inventory',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedPublicJobCount: null,
  verifiedIndiaJobCount: null,
  verifiedOn: '2026-10-23',
  verifiedSurfaceSummary: 'Rechecked 2026-10-23: the published MoEVing Freshteam handoff returns HTTP 200 with Freshteam’s invalid-domain/no-ats claimable-domain shell. The official Join Us page serves generic rental content. No current enumerable employer inventory is verified. The bounded native check throws with coverage-gap evidence for the inactive tenant; unknown or unavailable inventory never certifies zero. Public and India vacancy counts remain unknown.',
}

export default MOEVING_CATALOG
