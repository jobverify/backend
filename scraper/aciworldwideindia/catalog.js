import {
  ATS_PLATFORM,
  COMPANY_DOMAIN,
  COMPANY_NAME,
  CORPORATE_CAREERS_URL,
  COUNTRY_FILTER,
  DETAIL_API_BASE_URL,
  EXTRACTION_STRATEGY,
  LISTING_API_BASE_URL,
  NORMALIZATION_PROFILE,
  PAGINATION_STRATEGY,
  PARSER,
  PUBLIC_JOBS_BASE_URL,
  SITE_NUMBER,
  SOURCE,
  VERIFIED_AT,
  WORKSPACE_DOMAIN,
} from './script.js'

export const ACI_WORLDWIDE_INDIA_CATALOG = {
  source: SOURCE,
  companyName: COMPANY_NAME,
  companyCareerPage: CORPORATE_CAREERS_URL,
  companyDomain: COMPANY_DOMAIN,
  adapter: 'script',
  atsPlatform: ATS_PLATFORM,
  countryFilter: COUNTRY_FILTER,
  paginationStrategy: PAGINATION_STRATEGY,
  extractionStrategy: EXTRACTION_STRATEGY,
  parser: PARSER,
  normalizationProfile: NORMALIZATION_PROFILE,
  modulePath: 'scraper/aciworldwideindia/script.js',
  verifiedOn: VERIFIED_AT,
  verifiedSurfaceSummary:
    'Verified on July 14, 2026 that https://www.aciworldwide.com/about-aci/careers hands off Explore Opportunities to the public Oracle Candidate Experience site at https://ebwg.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/, and the public India finder currently exposes live ACI Worldwide roles in Pune and Bangalore.',
  workspaceDomain: WORKSPACE_DOMAIN,
  listingApiBaseUrl: LISTING_API_BASE_URL,
  detailApiBaseUrl: DETAIL_API_BASE_URL,
  publicJobsBaseUrl: PUBLIC_JOBS_BASE_URL,
  siteNumber: SITE_NUMBER,
}

export default ACI_WORLDWIDE_INDIA_CATALOG
