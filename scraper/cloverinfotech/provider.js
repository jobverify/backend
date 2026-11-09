import { JOB_OPENINGS_URL, SOURCE, COMPANY } from './script.js'

export const provider = {
  source: SOURCE,
  companyName: COMPANY,
  adapter: 'script',
  modulePath: '../../scraper/cloverinfotech/script.js',
  companyCareerPage: JOB_OPENINGS_URL,
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'official-job-openings-page-pagination',
  extractionStrategy:
    'verified-cloudflare-challenge-empty+preserve-first-party-job-openings-and-detail-parser',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'cloverinfotech.com',
  verifiedOn: '2026-08-14',
  verifiedSurfaceSummary:
    'Verified on Friday, August 14, 2026 that https://www.cloverinfotech.com/job-openings/ currently returns a Cloudflare-style "Just a moment..." blocker with the visible "Checking your browser..." heading and a ?ki-cf-botcl=1 redirect target instead of the previously public listings surface. This provider preserves the verified first-party URLs and returns an honest empty result while that blocked contract remains in place.',
}

export default provider

