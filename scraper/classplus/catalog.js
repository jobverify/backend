import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CLASSPLUS_CATALOG = {
  source: 'classplus',
  companyName: 'Classplus',
  officialBrandName: 'Classplus',
  adapter: 'script',
  companyCareerPage: 'https://classplusapp.com/careers/open-role',
  companyDomain: 'classplusapp.com',
  atsPlatform: 'official-first-party-public-jobs-api',
  countryFilter: 'India',
  paginationStrategy: 'single-public-api-response',
  extractionStrategy: 'official-careers-page+public-jobs-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-27',
  verifiedPublicPostingCount: 0,
  sourceScopeComplete: false,
  lifecycleCleanupAllowed: false,
  verifiedSurfaceSummary:
    '2026-10-27 current executable Classplus careers client delegates ordinary public GET listing and job-description requests. Registered source-only verification captured matching unfiltered initial/closing Jobs=[] responses: native global0 India0 full0 eligible0 unknown-country0. Native board complete; whole-employer universe unverified because current corporate SPA advertises no careers handoff and VIDU employer hierarchy is unknown. Source remains partial with cleanup false. Nonempty extraction has synthetic contract coverage, not a live nonempty detail qualification.',
  dryRunFile: 'classplus/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default CLASSPLUS_CATALOG
