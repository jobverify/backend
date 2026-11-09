import {
  CAREERS_URL,
  COMPANY,
  SOURCE,
} from './script.js'

export const provider = {
  source: SOURCE,
  companyName: COMPANY,
  adapter: 'script',
  modulePath: '../../scraper/aaravsolutions/script.js',
  companyCareerPage: CAREERS_URL,
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-plus-shared-hubspot-apply-form',
  extractionStrategy:
    'verified-homepage+verified-careers-page+inline-india-job-cards+shared-first-party-hubspot-application-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'aaravsolutions.com',
  verifiedOn: '2026-07-14',
  verifiedSurfaceSummary:
    'Verified https://www.aaravsolutions.com/ and https://www.aaravsolutions.com/careers/ on July 14, 2026. The official first-party careers page exposes public India roles as inline job cards and routes applicants to a shared first-party HubSpot application form on the same page.',
}

export default provider

