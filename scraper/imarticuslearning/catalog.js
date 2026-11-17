import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on August 2, 2026 that https://imarticus.org/ is the live first-party Imarticus Learning homepage and that https://imarticus.org/careers/ now resolves back to the same marketing homepage rather than a separate careers or employer jobs surface. The current first-party surface promotes learning programs such as ISFB and other job-ready certifications, but it does not expose a trustworthy public employer job board or ATS handoff.'

export const IMARTICUS_LEARNING_CATALOG = {
  source: 'imarticuslearning',
  companyName: 'Imarticus Learning',
  officialBrandName: 'Imarticus Learning',
  adapter: 'script',
  homepageUrl: 'https://imarticus.org/',
  companyCareerPage: 'https://imarticus.org/careers/',
  canonicalCareerServicesPage: 'https://imarticus.org/',
  companyDomain: 'imarticus.org',
  atsPlatform: 'official-current-student-career-services-inventory-unavailable',
  countryFilter: 'India',
  paginationStrategy: 'literal-current-career-services-student-publication-chain-opening-closing',
  extractionStrategy:
    'whole-current-student-course-and-placement-publication+employer-vacancy-inventory-unqualified+company-scope-held',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'imarticuslearning/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default IMARTICUS_LEARNING_CATALOG
