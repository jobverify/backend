import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const LOGINEXT_CATALOG = {
  source: 'loginext',
  companyName: 'LogiNext',
  officialBrandName: 'LogiNext',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'loginext/jobs.json',
  companyCareerPage: 'https://www.loginextsolutions.com/job-roles',
  jobsBoardUrl: 'https://www.loginextsolutions.com/job-roles',
  companyDomain: 'loginextsolutions.com',
  atsPlatform: 'first-party-nextjs-page-with-recruiterbox-links',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-nextjs-job-roles-page',
  extractionStrategy: 'verified-first-party-nextjs-flight-data+embedded-role-arrays+recruiterbox-apply-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on Thursday, July 16, 2026 that https://www.loginextsolutions.com/job-roles is the live official LogiNext first-party hiring page. The rendered page exposes embedded Next.js flight data with department role arrays, a Find Jobs handoff to https://loginext.hire.trakstar.com, and public per-role apply links on https://loginext.recruiterbox.com/jobs/, so this provider extracts India roles directly from that verified first-party page and fails closed if the embedded contract drifts.',
}

export default LOGINEXT_CATALOG
