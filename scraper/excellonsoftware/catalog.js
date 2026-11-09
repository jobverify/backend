import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const EXCELLON_SOFTWARE_CATALOG = {
  source: 'excellonsoftware',
  companyName: 'Excellon Software',
  officialBrandName: 'Excellon',
  adapter: 'script',
  homepageUrl: 'https://www.excellonsoft.com/',
  companyCareerPage: 'https://www.excellonsoft.com/about/careers/',
  atsPlatform: 'official-company-site-no-live-openings',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-page-without-public-job-listings',
  extractionStrategy: 'verified-first-party-careers-page+submit-job-application-form+returns-empty-array',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'excellonsoft.com',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.excellonsoft.com/about/careers/ was the live first-party Excellon careers page, that it promoted general culture content plus a Submit Job Application form, and that it exposed no trustworthy public role cards, locations, or apply links for live openings.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'excellonsoftware/jobs.json',
}

export default EXCELLON_SOFTWARE_CATALOG
