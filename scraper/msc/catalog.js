import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on September 13, 2026 that https://www.msc.com/en/careers links the official https://msc.csod.com/ux/ats/careersite/4/home board. The exact MSC tenant public search returns six India requisitions. Every page is validated against totalCount and repeated IDs; explicit country filtering preserves India scope. An incomplete or blocked inventory rejects the snapshot.'

export const MSC_CATALOG = {
  source: 'msc',
  companyName: 'MSC',
  officialBrandName: 'MSC Mediterranean Shipping Company',
  adapter: 'script',
  homepageUrl: 'https://www.msc.com/en',
  companyCareerPage: 'https://www.msc.com/en/careers',
  companyDomain: 'msc.com',
  atsPlatform: 'cornerstone-csod',
  countryFilter: 'India',
  paginationStrategy: 'complete-csod-requisition-count-pagination',
  extractionStrategy: 'verified-first-party-csod-handoff+exact-tenant+explicit-india-requisitions',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'msc/jobs.json',
  verifiedOn: '2026-09-13',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default MSC_CATALOG
