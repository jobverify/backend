import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AMICABLE_AI_CATALOG = {
  source: 'amicableai',
  companyName: 'Amicable AI',
  officialBrandName: 'amicable',
  adapter: 'script',
  companyCareerPage: 'https://amicable.io/careers',
  companyDomain: 'amicable.io',
  officialHomepageUrl: 'https://amicable.io/',
  officialScreenloopBoardUrl: 'https://app.screenloop.com/careers/amicable',
  officialSpeculativeApplyEmail: 'jobs@amicable.co.uk',
  atsPlatform: 'screenloop-public-careers',
  countryFilter: 'India',
  paginationStrategy:
    'declared-current-jobPosts-complete-array-local-pagination+final-inventory-after-public-details',
  extractionStrategy:
    'current-corporate-handoff+bound-public-components+same-ID-full-criteria+native-countries+closing',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: null,
  verifiedSurfaceSummary:
    'The configured https://amicable.io/ homepage links to https://amicable.io/careers, whose active vacancies section declares https://app.screenloop.com/careers/amicable. Current runtime qualifies the complete native jobPosts array and public same-ID full descriptions/countries, then checks final membership after closing details. The native employer is amicable; the historical Amicable AI catalog label does not assert a separate legal-employer identity. Missing dates stay null. Contradictory marketing copy and private application forms are not public-JD prerequisites. Company-wide recruitment absence and lifecycle cleanup remain unproved.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default AMICABLE_AI_CATALOG
