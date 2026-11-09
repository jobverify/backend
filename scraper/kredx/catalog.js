export const KREDX_CATALOG = {
  source: 'kredx',
  companyName: 'KredX',
  officialBrandName: 'KredX',
  adapter: 'script',
  modulePath: '../../scraper/kredx/script.js',
  dryRunFile: 'kredx/jobs.json',
  companyCareerPage: 'https://www.kredx.com/join-our-team',
  smartRecruitersBoardUrl: 'https://careers.smartrecruiters.com/Kredx',
  smartRecruitersListingApiUrl: 'https://api.smartrecruiters.com/v1/companies/Kredx/postings',
  smartRecruitersDetailApiUrlTemplate:
    'https://api.smartrecruiters.com/v1/companies/Kredx/postings/{{jobId}}',
  smartRecruitersCompanyIdentifier: 'Kredx',
  companyDomain: 'kredx.com',
  atsPlatform: 'smartrecruiters',
  countryFilter: 'India',
  verifiedPublicJobCount: 8,
  verifiedSampleJobTitle: 'Product Manager',
  paginationStrategy: 'official-careers-page-plus-public-smartrecruiters-listing-api',
  extractionStrategy:
    'verified-first-party-openings-page+smartrecruiters-board+listing-api+detail-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that https://www.kredx.com/join-our-team is the live first-party KredX careers page, that it visibly listed current openings including Product Manager and Company Secretary, and that the public SmartRecruiters board at https://careers.smartrecruiters.com/Kredx plus the listing API at https://api.smartrecruiters.com/v1/companies/Kredx/postings exposed 8 public jobs with overlapping titles.',
}

export default KREDX_CATALOG

