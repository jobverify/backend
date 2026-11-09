import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SPARX_IT_SOLUTIONS_CATALOG = {
  source: 'sparxitsolutions',
  companyName: 'SPARX IT Solutions',
  officialBrandName: 'SparxIT',
  adapter: 'script',
  homepageUrl: 'https://www.sparxitsolutions.com/',
  companyCareerPage: 'https://www.sparxitsolutions.com/career.shtml',
  atsPlatform: 'first-party-careers-accordion',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-accordion-page',
  extractionStrategy: 'verified-careers-accordion+mail-to-apply-links+india-role-blocks',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'sparxitsolutions.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.sparxitsolutions.com/career.shtml was the live first-party SPARX IT Solutions careers page, that it exposed public accordion role blocks for Senior Android Developer, Project Consultant, and Python Developer in Noida (Sector 63), and that the role blocks used the first-party apply mailbox mailto:talent@sparxitsolutions.com.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SPARX_IT_SOLUTIONS_CATALOG
