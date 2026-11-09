import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Tuesday, August 4, 2026 that the previously verified Sapphire Foods careers routes on https://www.sapphire.terbiumsolutions.com still belong to the official first-party host but now return the same branded "Page not found" shell for the landing, store, and corporate careers pages. Because the public role inventory is no longer exposed on those official routes as of Tuesday, August 4, 2026, the scraper now treats that consistent branded 404 state as a verified empty condition and returns no jobs.'

export const SAPPHIRE_FOODS_CATALOG = {
  source: 'sapphirefoods',
  companyName: 'Sapphire Foods',
  officialBrandName: 'Sapphire Foods India Ltd.',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'sapphirefoods/jobs.json',
  officialHomepageUrl: 'https://www.sapphirefoods.in/',
  companyCareerPage: 'https://www.sapphire.terbiumsolutions.com/careers',
  storeCareersPageUrl: 'https://www.sapphire.terbiumsolutions.com/careers/store-careers',
  corporateCareersPageUrl: 'https://www.sapphire.terbiumsolutions.com/careers/corporate-careers',
  resolvedCareersHost: 'www.sapphire.terbiumsolutions.com',
  companyDomain: 'sapphirefoods.in',
  atsPlatform: 'official-company-site-public-role-pages',
  countryFilter: 'India',
  paginationStrategy: 'verified-branded-404-empty-state-or-store-and-corporate-pages-no-pagination',
  extractionStrategy:
    'verified-branded-404-empty-state-or-verified-careers-landing+verified-store-careers-page+verified-corporate-careers-page+role-card-link-extraction',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedSampleStoreRoleTitle: 'Assistant Restaurant Manager',
  verifiedSampleCorporateRoleTitle: 'Manager - Treasury ( Finance & Accounts)',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default SAPPHIRE_FOODS_CATALOG
