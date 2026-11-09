export const INVENGER_CATALOG = {
  source: 'invenger',
  companyName: 'Invenger',
  officialBrandName: 'Invenger',
  adapter: 'script',
  modulePath: '../../scraper/invenger/script.js',
  companyCareerPage: 'https://www.invenger.com/careers',
  officialCareersPageUrl: 'https://www.invenger.com/careers',
  officialJobsPageUrl: 'https://www.invenger.com/jobs',
  detailUrlPattern: 'https://www.invenger.com/jobs/{slug}-{id}',
  applicationUrlPattern: 'https://www.invenger.com/jobs/apply/{slug}-{id}',
  companyDomain: 'invenger.com',
  atsPlatform: 'official-company-jobs-board',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-jobs-page-with-detail-pages',
  extractionStrategy: 'verified-first-party-careers-page+jobs-page+detail-pages+first-party-apply-surface',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on Thursday, July 16, 2026 that https://www.invenger.com/careers is the live first-party Invenger careers route, that the public first-party jobs surface at https://www.invenger.com/jobs currently exposes seven India listings, and that the live detail pages include roles such as Business Development Executive and IT Admin with first-party apply URLs under https://www.invenger.com/jobs/apply/.',
  dryRunFile: 'invenger/jobs.json',
}

export default INVENGER_CATALOG

