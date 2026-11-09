import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const DIGITAL_WEB_SOLUTIONS_CATALOG = {
  source: 'digitalwebsolutions',
  companyName: 'Digital Web Solutions',
  officialBrandName: 'Digital Web Solutions',
  adapter: 'script',
  homepageUrl: 'https://www.digitalwebsolutions.com/',
  companyCareerPage: 'https://www.digitalwebsolutions.com/careers/',
  officialJobsBoardUrl: 'https://hirenext.io/co/digital-web-solutions/',
  companyDomain: 'digitalwebsolutions.com',
  atsPlatform: 'hirenext',
  countryFilter: 'Global',
  paginationStrategy: 'complete-global-native-board+paired-full-role-models',
  extractionStrategy: 'current-corporate-handoff+literal-native-board-redirect+own-JobPosting+complete-visible-criteria+closing-reconciliation',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-11-05',
  verifiedPublicJobCount: 5,
  verifiedIndiaJobCount: 1,
  verifiedSurfaceSummary:
    'Verified on November 5, 2026: the current own careers page advertises the exact Hirenext company account. Its literal board redirect and all five full global native models reconcile at closing. Senior Outreach Manager has an explicit own India worksite; four roles retain unknown countries. Complete visible responsibilities are preserved beyond a structured 2000-character excerpt. The original Global catalog scope is preserved; company inventory scope and lifecycle cleanup remain unqualified.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default DIGITAL_WEB_SOLUTIONS_CATALOG
