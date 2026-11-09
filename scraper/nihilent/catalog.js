import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 18, 2026 that https://www.nihilent.com/careers/ is the live first-party Nihilent careers page and that its Job Openings section links to the first-party openings board at https://www.nihilent.com/job-openings/. The public openings page exposes same-page role cards for India locations, including ServiceNow Lead/ Architect and Data Engineering (MS Fabric), so this provider treats the first-party openings page as the trustworthy public jobs surface.'

export const NIHILENT_CATALOG = {
  source: 'nihilent',
  companyName: 'Nihilent',
  officialBrandName: 'Nihilent',
  adapter: 'script',
  companyCareerPage: 'https://www.nihilent.com/careers/',
  officialCareersPageUrl: 'https://www.nihilent.com/job-openings/',
  companyDomain: 'nihilent.com',
  atsPlatform: 'first-party-html-board',
  countryFilter: 'India',
  paginationStrategy: 'single-public-openings-page',
  extractionStrategy:
    'verified-first-party-careers-page+verified-first-party-job-openings-page+same-page-role-cards',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'nihilent/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default NIHILENT_CATALOG
