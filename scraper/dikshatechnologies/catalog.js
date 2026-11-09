import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const DIKSHA_TECHNOLOGIES_CATALOG = {
  source: 'dikshatechnologies',
  companyName: 'Diksha Technologies',
  officialBrandName: 'Diksha',
  adapter: 'script',
  homepageUrl: 'https://dikshatech.com/',
  companyCareerPage: 'https://dikshatech.com/join-diksha-now/',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'first-party-query-pagination',
  extractionStrategy: 'verified-first-party-job-cards+query-pagination',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'dikshatech.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://dikshatech.com/join-diksha-now/ remained Diksha\'s exact first-party careers surface, exposed Search jobs cards such as Tech Support and Business Development Executive, and paginated via trusted first-party query pages through ?page=3 with public /job/ detail URLs.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default DIKSHA_TECHNOLOGIES_CATALOG
