import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const RM_EDUCATION_SOLUTIONS_CATALOG = {
  source: 'rmeducationsolutions',
  companyName: 'RM Education Solutions',
  officialBrandName: 'RM India (RM Education Solutions India Private Limited)',
  adapter: 'script',
  homepageUrl: 'https://www.rmindia.co.in/',
  companyCareerPage: 'https://careers.rm.com/jobs',
  locationsIndexUrl: 'https://careers.rm.com/jobs/locations',
  indiaCountryJobsUrl: 'https://careers.rm.com/jobs/locations/country/India',
  companyDomain: 'careers.rm.com',
  atsPlatform: 'rm-jibe-careers-shell-with-untrusted-public-listing-feed',
  countryFilter: 'India',
  paginationStrategy: 'rm-india-page-plus-empty-jibe-country-shell',
  extractionStrategy: 'verified-rm-india-page+verified-jibe-jobs-shell+verified-empty-country-route+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.rmindia.co.in/ redirected to the live RM India page on rm.com and still exposed Life @ RM India plus the Trivandrum India-delivery-center copy. The linked careers surface at https://careers.rm.com/jobs rendered only the RM Jibe shell, the locations index exposed India and Trivandrum navigation, and the direct India country route still resolved to the same empty See jobs by: Categories Locations shell. Search-engine-indexed RM detail pages were discoverable only as title-only shells from this environment, so there was no trustworthy enumerable public listing feed for a company-local scraper.',
  dryRunFile: 'rmeducationsolutions/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default RM_EDUCATION_SOLUTIONS_CATALOG
