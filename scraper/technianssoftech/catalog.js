import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, August 14, 2026 that https://nians.com/ remains the live official Nians homepage for Technians Softech, that it still links candidates to https://nians.com/job/, and that the first-party Nians jobs archive now publishes roles through the public WordPress REST API at https://nians.com/wp-json/wp/v2/job?per_page=100&page=1&_embed=wp:term. Verified the archive still uses the title "Current Job Openings in Gurgaon, Mumbai - Nians" with the "Technians is now Nians" brand handoff, and that the public API returned 59 live India openings across Gurugram, Mumbai, and Remote (India), including the same-domain detail page https://nians.com/job/business-head/.'

export const TECHNIANS_SOFTECH_CATALOG = {
  source: 'technianssoftech',
  companyName: 'Technians Softech',
  officialBrandName: 'Nians',
  adapter: 'script',
  homepageUrl: 'https://nians.com/',
  companyCareerPage: 'https://nians.com/job/',
  jobsApiUrl: 'https://nians.com/wp-json/wp/v2/job',
  companyDomain: 'nians.com',
  atsPlatform: 'official-company-careers-plus-wordpress-jobs-api',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-jobs-archive-plus-paged-wordpress-rest-api',
  extractionStrategy:
    'verified-homepage-career-link+verified-jobs-archive+wp-json-job+embedded-taxonomies+same-domain-job-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedPublicJobCount: 59,
  verifiedIndiaJobCount: 59,
  verifiedOn: '2026-08-14',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'technianssoftech/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default TECHNIANS_SOFTECH_CATALOG
