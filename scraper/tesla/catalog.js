import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TESLA_CATALOG = {
  source: 'tesla',
  companyName: 'Tesla',
  officialBrandName: 'Tesla',
  adapter: 'script',
  homepageUrl: 'https://www.tesla.com/',
  companyCareerPage: 'https://www.tesla.com/careers',
  indiaLocaleCareersPageUrl: 'https://www.tesla.com/en_in/careers',
  searchPageUrl: 'https://www.tesla.com/careers/search/',
  indiaListingsPageUrl: 'https://www.tesla.com/careers/search/?department=3',
  sampleIndiaEngineeringJobUrl:
    'https://www.tesla.com/careers/search/job/software-engineer-full-stack-tesla-cloud-platform-251983',
  sampleIndiaSupportJobUrl:
    'https://www.tesla.com/careers/search/job/customer-support-specialist-237421',
  sampleIndiaServiceJobUrl:
    'https://www.tesla.com/careers/search/job/service-advisor-237425',
  atsPlatform: 'official-company-site-unresolved-listing-contract',
  countryFilter: 'India',
  paginationStrategy:
    'verified-first-party-search-surface-without-verified-batch-safe-listing-contract',
  extractionStrategy:
    'verified-first-party-careers-page+verified-search-surface+verified-india-detail-pages-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'tesla.com',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.tesla.com/careers and the India-relevant locale page https://www.tesla.com/en_in/careers both handed applicants to the official Tesla jobs surface at https://www.tesla.com/careers/search/, that https://www.tesla.com/careers/search/?department=3 exposed live India listings such as Mumbai Suburban, Maharashtra roles, and that first-party India detail pages such as https://www.tesla.com/careers/search/job/software-engineer-full-stack-tesla-cloud-platform-251983, https://www.tesla.com/careers/search/job/customer-support-specialist-237421, and https://www.tesla.com/careers/search/job/service-advisor-237425 were live; however, no verified batch-safe listing contract or public API was confirmed from the first-party surface.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default TESLA_CATALOG
