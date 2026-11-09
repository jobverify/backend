export const KFIN_TECHNOLOGIES_CATALOG = {
  source: 'kfintechnologies',
  companyName: 'KFin Technologies',
  officialBrandName: 'KFintech',
  adapter: 'script',
  modulePath: '../../scraper/kfintechnologies/script.js',
  dryRunFile: 'kfintechnologies/jobs.json',
  companyCareerPage: 'https://www.kfintech.com/career/',
  officialJobsArchiveUrl: 'https://www.kfintech.com/jobs/',
  verifiedSampleJobUrl: 'https://www.kfintech.com/jobs/associate-senior-associate-mutual-fund-services-uti/',
  verifiedSampleJobTitle: 'Associate/ Senior Associate - Mutual Fund Services (UTI)',
  companyDomain: 'kfintech.com',
  verifiedPublicJobCount: 8,
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-page-plus-linked-first-party-job-detail-pages',
  extractionStrategy: 'verified-first-party-careers-page+linked-first-party-job-detail-pages+same-page-application-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that https://www.kfintech.com/career/ is the live first-party KFintech careers page for KFin Technologies, that https://www.kfintech.com/jobs/ is the matching first-party jobs archive, and that the careers page exposed 8 public first-party job detail pages including https://www.kfintech.com/jobs/associate-senior-associate-mutual-fund-services-uti/ for Associate/ Senior Associate - Mutual Fund Services (UTI).',
}

export default KFIN_TECHNOLOGIES_CATALOG

