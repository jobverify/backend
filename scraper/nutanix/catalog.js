import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, August 14, 2026 that Nutanix\'s official careers surface at https://careers.nutanix.com/en/jobs/ still returned a Cloudflare 403 challenge page to direct non-browser fetches, while the public Jobvite surfaces at https://jobs.jobvite.com/nutanix and https://jobs.jobvite.com/nutanix/jobs remained live, Nutanix-branded, cross-linked back to the official current openings page, and exposed India openings including Financial Analyst, Senior Payroll Specialist, and Engineering Manager - Observability. The Financial Analyst detail page at https://jobs.jobvite.com/nutanix/job/oucAAfwA was also publicly readable on the verified date.'

export const NUTANIX_CATALOG = {
  source: 'nutanix',
  companyName: 'Nutanix',
  adapter: 'script',
  companyCareerPage: 'https://careers.nutanix.com/en/jobs/',
  companyDomain: 'nutanix.com',
  officialCareersHandoffUrl: 'https://jobs.jobvite.com/nutanix',
  jobListingsPageUrl: 'https://jobs.jobvite.com/nutanix/jobs',
  atsPlatform: 'jobvite',
  countryFilter: 'India',
  paginationStrategy: 'verified-official-careers-page-plus-public-jobvite-current-openings-board',
  extractionStrategy:
    'verified-official-careers-page+official-job-detail-apply-handoff+public-jobvite-current-openings+india-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-14',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'nutanix/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default NUTANIX_CATALOG
