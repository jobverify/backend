import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const THINKSYS_SOFTWARE_CATALOG = {
  source: 'thinksyssoftware',
  companyName: 'Thinksys Software',
  officialBrandName: 'ThinkSys',
  adapter: 'script',
  homepageUrl: 'https://thinksys.com/',
  companyCareerPage: 'https://thinksys.com/careers/',
  companyDomain: 'thinksys.com',
  atsPlatform: 'official-first-party-job-pages',
  countryFilter: 'India',
  paginationStrategy: 'single-page-current-openings',
  extractionStrategy: 'first-party-job-card-list+detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://thinksys.com/careers/ was the live first-party ThinkSys careers surface and that the public current-openings page exposed MS SQL Database Administrator, Talent Acquisition Specialist, and Software Engineer (.NET & React) on the verified date.',
  dryRunFile: 'thinksyssoftware/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default THINKSYS_SOFTWARE_CATALOG
