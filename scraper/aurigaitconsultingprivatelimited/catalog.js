import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AURIGA_IT_CONSULTING_PRIVATE_LIMITED_CATALOG = {
  source: 'aurigaitconsultingprivatelimited',
  companyName: 'Auriga IT Consulting Private Limited',
  officialBrandName: 'Auriga',
  adapter: 'script',
  homepageUrl: 'https://aurigait.com/',
  companyCareerPage: 'https://aurigait.com/careers/',
  externalHandoffUrl: 'https://aurigait.keka.com/careers',
  companyDomain: 'aurigait.com',
  atsPlatform: 'keka-embed-api',
  countryFilter: 'India',
  paginationStrategy: 'first-party-careers-page-plus-single-keka-active-jobs-endpoint',
  extractionStrategy:
    'verified-first-party-careers-page+verified-keka-handoff+embedded-khConfig-or-bootstrapped-careerportal-document+active-keka-embed-api+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-01',
  verifiedSurfaceSummary:
    'Verified on Saturday, August 1, 2026 that https://aurigait.com/careers/ is still the live first-party Auriga careers shell and that it links candidates through Find Job Openings to the public handoff at https://aurigait.keka.com/careers. The local scraper is pinned to that first-party shell plus the Keka embed configuration, including the current bootstrapped careerportal document, so it can return India jobs only.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default AURIGA_IT_CONSULTING_PRIVATE_LIMITED_CATALOG
