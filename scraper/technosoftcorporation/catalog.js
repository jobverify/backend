import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TECHNOSOFT_CORPORATION_CATALOG = {
  source: 'technosoftcorporation',
  companyName: 'Technosoft Corporation',
  officialBrandName: 'Technosoft Corporation',
  adapter: 'script',
  homepageUrl: 'http://www.technosoftcorp.com/',
  companyCareerPage: 'http://www.technosoftcorp.com/',
  legacyRedirectUrl: 'https://www.apexon.com/',
  companyDomain: 'technosoftcorp.com',
  atsPlatform: 'legacy-domain-redirect-no-public-jobs',
  countryFilter: 'United States',
  paginationStrategy: 'legacy-homepage-redirect-plus-common-careers-404-check',
  extractionStrategy:
    'verified-legacy-homepage-redirect+verified-empty-first-party-careers-routes+no-exact-name-public-jobs',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-09-13',
  verifiedSurfaceSummary:
    "Verified on September 13, 2026 that the first-party homepage http://www.technosoftcorp.com/ still states Technosoft is now Apexon with the exact Apexon handoff. A complete five-request validation using ordinary Node headers returned the unchanged rebrand homepage and exact empty 404 responses from http://www.technosoftcorp.com/careers, /careers/, /jobs and /join-us. Paired checks showed obsolete Chrome impersonation headers instead produced HTTP 403, so the source uses ordinary client headers. There is no trustworthy exact-name public jobs surface established for Technosoft Corporation. Only the verified rebrand plus all four exact empty 404 routes can confirm the retired inventory; access, transport and cancellation failures propagate, and Apexon jobs are never imported.",
  dryRunFile: 'technosoftcorporation/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default TECHNOSOFT_CORPORATION_CATALOG
