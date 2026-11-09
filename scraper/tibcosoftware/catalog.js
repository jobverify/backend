import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TIBCO_SOFTWARE_CATALOG = {
  source: 'tibcosoftware',
  companyName: 'TIBCO Software',
  officialBrandName: 'TIBCO',
  adapter: 'script',
  homepageUrl: 'https://www.tibco.com/',
  companyCareerPage: 'https://www.tibco.com/contact-us',
  careersHubUrl: 'https://careers.cloud.com/',
  careersSearchUrl: 'https://careers.cloud.com/jobs/search',
  companyDomain: 'tibco.com',
  atsPlatform: 'official-company-careers-no-public-jobs',
  countryFilter: 'India',
  paginationStrategy: 'official-contact-page-plus-generic-multi-brand-careers-validation',
  extractionStrategy:
    'verified-official-contact-page+verified-generic-cloud-careers-handoff-or-documented-access-challenge+no-stable-tibco-only-public-jobs-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-14',
  verifiedSurfaceSummary:
    'Verified on Friday, August 14, 2026 that https://www.tibco.com/contact-us is the live official TIBCO contact page and still links applicants to https://careers.cloud.com/. Verified that the linked Cloud Software Group careers hub and public search page remain a generic multi-brand surface with Brand filters for Citrix, Cloud Software Group Corporate, and Spotfire rather than a stable TIBCO-only public jobs endpoint, and that raw Node HTTP requests from this runtime can now receive an AWS WAF or empty 202 challenge response instead of stable HTML. The local provider therefore returns [] while the official handoff stays pinned to that generic Cloud Software Group surface or its documented access challenge.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'tibcosoftware/jobs.json',
}

export default TIBCO_SOFTWARE_CATALOG
