import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const INVENIO_BUSINESS_SOLUTIONS_CATALOG = {
  source: 'inveniobusinesssolutions',
  companyName: 'Invenio Business Solutions',
  officialBrandName: 'Invenio',
  adapter: 'script',
  homepageUrl: 'https://invenio-solutions.com/',
  companyCareerPage: 'https://invenio-solutions.com/careers',
  officialJobsBoardUrl: 'https://jobs.jobvite.com/inveniolsi/jobs',
  atsPlatform: 'jobvite-zero-openings',
  countryFilter: 'India',
  paginationStrategy: 'first-party-faq-plus-jobvite-zero-openings',
  extractionStrategy: 'verified-first-party-careers-faq+verified-jobvite-zero-openings+return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'invenio-solutions.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://invenio-solutions.com/careers is the exact Invenio careers page, that its FAQ points candidates to https://jobs.jobvite.com/inveniolsi and talent.hr@invenio-solutions.com, and that the current Jobvite board at https://jobs.jobvite.com/inveniolsi/jobs says There are currently no open jobs.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default INVENIO_BUSINESS_SOLUTIONS_CATALOG
