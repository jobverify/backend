import {
  COMPANY,
  CURRENT_OPPORTUNITIES_URL,
  SOURCE,
} from './script.js'

export const provider = {
  source: SOURCE,
  companyName: COMPANY,
  adapter: 'script',
  modulePath: '../../scraper/cyfuture/script.js',
  companyCareerPage: CURRENT_OPPORTUNITIES_URL,
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'static-tabbed-first-party-openings-page',
  extractionStrategy:
    'verified-homepage+verified-careers-page+tabbed-openings-page+first-party-detail-pages+shared-upload-resume-apply-page',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'cyfuture.com',
  verifiedOn: '2026-07-14',
  verifiedSurfaceSummary:
    'The official Cyfuture homepage links to careers.html, which links to current-opportunities.html, and that first-party page exposes public India openings with apply-job detail pages and a shared upload-resume apply handoff.',
}

export default provider

