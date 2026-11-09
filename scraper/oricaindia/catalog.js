import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ORICA_INDIA_CATALOG = {
  source: 'oricaindia',
  companyName: 'Orica India',
  officialBrandName: 'Orica',
  adapter: 'script',
  officialCareersPageUrl: 'https://www.orica.com/careers',
  companyCareerPage: 'https://careers.orica.com/search/?createNewAlert=false&q=&locationsearch=India',
  verifiedSampleJobUrl: 'https://careers.orica.com/job/Hyderabad-Tax-Lead%2C-India-TG-500081/1377285800/',
  companyDomain: 'careers.orica.com',
  atsPlatform: 'successfactors',
  countryFilter: 'India',
  paginationStrategy: 'successfactors-search-page-query',
  extractionStrategy:
    'verified-official-orica-careers-page+india-search-results-table+detail-pages+talentcommunity-apply-handoff',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.orica.com/careers is Orica\'s official first-party careers landing page and that it hands applicants to the public first-party jobs board at https://careers.orica.com/. The India-filtered public search URL https://careers.orica.com/search/?createNewAlert=false&q=&locationsearch=India returned live server-rendered search results, and the public detail page https://careers.orica.com/job/Hyderabad-Tax-Lead%2C-India-TG-500081/1377285800/ plus other India roles such as Gomia openings exposed first-party apply handoffs under /talentcommunity/apply/.',
  dryRunFile: 'oricaindia/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default ORICA_INDIA_CATALOG
