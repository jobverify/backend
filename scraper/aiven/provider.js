export const provider = {
  source: 'aiven',
  companyName: 'Aiven',
  officialBrandName: 'Aiven',
  adapter: 'script',
  modulePath: '../../scraper/aiven/script.js',
  companyCareerPage: 'https://aiven.io/careers/job',
  companyDomain: 'aiven.io',
  atsPlatform: 'first-party-job-pages',
  countryFilter: 'India',
  paginationStrategy: 'single-public-listing-page',
  extractionStrategy: 'verified-first-party-listing-page+first-party-detail-pages+india-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-25',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 25, 2026 that https://aiven.io/careers/job was the live first-party Aiven jobs listing, that it publicly exposed 35 jobs on the verified date, and that the same-domain listing included India role links for Account Executive Bengaluru, Karnataka, India and Technical Support Engineer - Bengaluru Bengaluru, Karnataka, India.',
  dryRunFile: 'aiven/jobs.json',
}

export default provider

