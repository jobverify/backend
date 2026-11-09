import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Monday, August 3, 2026 that https://maintec.com/jobs/ is the live first-party Maintec jobs archive and that its current first-party detail set includes CICS System programmer, DB2 System programmer, and Mainframe DB2 DBA. The CICS and DB2 detail pages currently require US Eastern hours, the Mainframe DB2 DBA detail page still omits trustworthy India-localized job metadata, and the archive itself exposes no explicit India location fields, so this local provider stays fail-closed until Maintec publishes trustworthy India job metadata on the first-party archive.'

export const MAINTEC_TECHNOLOGIES_CATALOG = {
  source: 'maintectechnologies',
  companyName: 'Maintec Technologies',
  officialBrandName: 'Maintec',
  adapter: 'script',
  homepageUrl: 'https://maintec.com/',
  companyCareerPage: 'https://maintec.com/jobs/',
  companyDomain: 'maintec.com',
  atsPlatform: 'first-party-jobs-archive-ambiguous-india-location',
  countryFilter: 'India',
  paginationStrategy: 'jobs-archive-plus-representative-detail-validation',
  extractionStrategy:
    'verified-jobs-archive+us-hours-or-expired-detail-pages+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-03',
  verifiedPublicJobCount: 0,
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'maintectechnologies/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default MAINTEC_TECHNOLOGIES_CATALOG
