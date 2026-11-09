import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 25, 2026 that https://baserow.io/jobs was the live first-party Baserow jobs page, that it publicly exposed 1 public opening on the same-domain detail page https://baserow.io/jobs/product-specialist-baserow, and that both the listing page and the linked detail page described the opening as Remote - Europe or Americas with zero India locations.'

export const BASEROW_CATALOG = {
  source: 'baserow',
  companyName: 'Baserow',
  officialBrandName: 'Baserow',
  adapter: 'script',
  companyCareerPage: 'https://baserow.io/jobs',
  companyDomain: 'baserow.io',
  atsPlatform: 'official-first-party-jobs-page',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-jobs-page-current-empty-india-slice',
  extractionStrategy:
    'verified-first-party-jobs-page+same-domain-job-detail-page+return-empty-when-no-india-locations',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-25',
  verifiedPublicJobCount: 1,
  verifiedSampleJobTitle: 'Product Specialist - Baserow',
  verifiedSampleJobUrl: 'https://baserow.io/jobs/product-specialist-baserow',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'baserow/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default BASEROW_CATALOG
