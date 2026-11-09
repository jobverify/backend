import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const INFINITI_SOFTWARE_SOLUTIONS_CATALOG = {
  source: 'infinitisoftwaresolutions',
  companyName: 'Infiniti Software Solutions',
  officialBrandName: 'Infiniti Software Solutions',
  adapter: 'script',
  homepageUrl: 'https://www.infinitisoftware.net/',
  companyCareerPage: 'https://www.infinitisoftware.net/careers/',
  applyDomain: 'goodfit.so',
  companyDomain: 'infinitisoftware.net',
  atsPlatform: 'official-first-party-careers-linkout',
  countryFilter: 'India',
  paginationStrategy: 'single-page',
  extractionStrategy: 'first-party-job-sections-plus-goodfit-apply-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.infinitisoftware.net/careers/ was the live first-party Infiniti Software Solutions careers page and that it publicly listed openings including Customer Success Manager and Security Compliance Lead with apply links on the Goodfit domain at https://app.goodfit.so/.',
  dryRunFile: 'infinitisoftwaresolutions/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default INFINITI_SOFTWARE_SOLUTIONS_CATALOG
