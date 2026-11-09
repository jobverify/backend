import {
  CAREERS_URL,
  HOMEPAGE_URL,
  SMARTRECRUITERS_COMPANY_IDENTIFIER,
  SMARTRECRUITERS_DETAIL_API_URL_TEMPLATE,
  SMARTRECRUITERS_LISTING_API_URL,
  SOURCE,
  COMPANY,
  VERIFIED_AT,
} from './script.js'

export const ABHIBUS_CATALOG = {
  source: SOURCE,
  companyName: COMPANY,
  companyCareerPage: CAREERS_URL,
  companyDomain: 'abhibus.com',
  adapter: 'script',
  atsPlatform: 'smartrecruiters',
  countryFilter: 'India',
  paginationStrategy: 'official-page-plus-smartrecruiters-api',
  extractionStrategy: 'verified-first-party-careers-page+embedded-smartrecruiters-api+detail-api+india-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  modulePath: 'scraper/abhibus/script.js',
  verifiedOn: VERIFIED_AT,
  verifiedSurfaceSummary:
    'Verified on July 19, 2026 that https://www.abhibus.com/careers/ is the live first-party AbhiBus careers page and now embeds the official SmartRecruiters postings API https://api.smartrecruiters.com/v1/companies/AbhiBus/postings. The API returned public India postings with SmartRecruiters detail/apply URLs under jobs.smartrecruiters.com/AbhiBus.',
  smartRecruitersCompanyIdentifier: SMARTRECRUITERS_COMPANY_IDENTIFIER,
  smartRecruitersListingApiUrl: SMARTRECRUITERS_LISTING_API_URL,
  smartRecruitersDetailApiUrlTemplate: SMARTRECRUITERS_DETAIL_API_URL_TEMPLATE,
  homepageUrl: HOMEPAGE_URL,
}

export default ABHIBUS_CATALOG
