import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AVASO_TECHNOLOGY_SOLUTIONS_CATALOG = {
  source: 'avasotechnologysolutions',
  companyName: 'AVASO Technology Solutions',
  officialBrandName: 'AVASO TECH PRIVATE LIMITED',
  adapter: 'script',
  homepageUrl: 'https://www.avasotech.com/',
  companyCareerPage: 'https://careers.avasotech.com/search/?createNewAlert=false&q=&locationsearch=',
  officialCareersLandingUrl: 'https://careers.avasotech.com/job/',
  companyDomain: 'careers.avasotech.com',
  atsPlatform: 'first-party-successfactors-search-board',
  countryFilter: 'India',
  paginationStrategy: 'successfactors-search-pagination',
  extractionStrategy: 'verified-successfactors-search-results+detail-pages+india-country-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that AVASO Technology Solutions linked its exact first-party careers hub from https://www.avasotech.com/ to the SuccessFactors board at https://careers.avasotech.com/job/ and the searchable jobs surface at https://careers.avasotech.com/search/?createNewAlert=false&q=&locationsearch=. The live board exposed Results 1 – 25 of 32 on page 1 of 2 with a page-two startrow=25 link, and India rows such as Service Desk Coordinator in Mohali and Associate Manager Service Delivery in Bangalore resolved to first-party detail pages and apply routes on careers.avasotech.com.',
  dryRunFile: 'avasotechnologysolutions/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default AVASO_TECHNOLOGY_SOLUTIONS_CATALOG
