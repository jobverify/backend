import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const INDI_IT_SOLUTIONS_CATALOG = {
  source: 'indiitsolutions',
  companyName: 'INDI IT SOLUTIONS',
  officialBrandName: 'Indi IT Solutions',
  adapter: 'script',
  companyCareerPage: 'https://indiit.com/career/',
  officialCareersPageUrl: 'https://indiit.com/career/',
  companyDomain: 'indiit.com',
  atsPlatform: 'official-company-current-marketing-publisher-inventory-unavailable',
  countryFilter: 'India',
  paginationStrategy: 'literal-root-redirect-and-seven-declared-programmes-opening-closing',
  extractionStrategy: 'whole-current-publisher+literal-careers-null-preference+native-inventory-unavailable+company-scope-held',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary:
    'Verified on August 2, 2026 that https://indiit.com/career/ is the live first-party Indi IT Solutions careers page, that its Top Opportunities Right Now section exposes five visible roles including two separate Marketing Analyst cards, HR Specialist, Graphic Designer, and UI/UX Designer, and that the page still routes applicants through a shared Join Our Company / Apply Now CTA plus hr@indiit.com resume instructions.',
  dryRunFile: 'indiitsolutions/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default INDI_IT_SOLUTIONS_CATALOG
