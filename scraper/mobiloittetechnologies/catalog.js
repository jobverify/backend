import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MOBILOITTE_TECHNOLOGIES_CATALOG = {
  source: 'mobiloittetechnologies',
  companyName: 'Mobiloitte Technologies',
  officialBrandName: 'Mobiloitte',
  adapter: 'script',
  homepageUrl: 'https://www.mobiloitte.com/',
  companyCareerPage: 'https://www.mobiloitte.com/careers',
  companyDomain: 'mobiloitte.com',
  atsPlatform: 'first-party-careers-page',
  countryFilter: 'India',
  paginationStrategy: 'current-visible-own-role-links-with-independent-closing-recheck',
  extractionStrategy:
    'current-corporate-handoff+own-canonical-JobPosting+visible-full-criteria+typed-country+closing-role-recheck',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: null,
  verifiedPublicJobCount: null,
  verifiedIndiaJobCount: null,
  sourceScopeComplete: false,
  lifecycleCleanupAllowed: false,
  zeroResultPolicy: 'coverage-gap',
  verifiedSurfaceSummary:
    'Current own role canonical identity, visible legal employer heading, native brand organization, typed work-country and every visible full criteria section are checked against the JobPosting. Corporate handoff, listing and each own role are reread before partial positive output. Company totals and empty inventory remain unproved; cleanup is forbidden.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'mobiloittetechnologies/jobs.json',
}

export default MOBILOITTE_TECHNOLOGIES_CATALOG
