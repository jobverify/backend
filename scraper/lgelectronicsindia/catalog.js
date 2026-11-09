import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const LG_ELECTRONICS_INDIA_CATALOG = {
  source: 'lgelectronicsindia',
  companyName: 'LG Electronics India',
  officialBrandName: 'LG Electronics India',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'lgelectronicsindia/jobs.json',
  companyCareerPage: 'https://globalcareers.lge.com/locations/IN',
  companyDomain: 'globalcareers.lge.com',
  atsPlatform: 'official-company-site-plus-first-party-jobs-api',
  countryFilter: 'India',
  paginationStrategy: 'browser-validated-india-location-page-plus-paged-first-party-jobs-api',
  extractionStrategy:
    'browser-validated-lg-india-location-page+verified-first-party-jobs-api+india-country-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-14',
  verifiedSurfaceSummary:
    'Verified on Friday, August 14, 2026 that https://globalcareers.lge.com/locations/IN is the live LG Global Careers India location page and that its current public contract still exposes the India title, Explore Jobs CTA, Equal Opportunity section, and LG Electronics branding. The first-party jobs API at https://globalcareers.lge.com/api/job/v1/jobs/ remains publicly accessible and currently exposes open India roles including IT Infra & Security/Maintenance - AM/DM in Noida and Autosar Dev_VS in Bengaluru, so this scraper continues returning public India jobs from the verified first-party feed.',
}

export default LG_ELECTRONICS_INDIA_CATALOG
