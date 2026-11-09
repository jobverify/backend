export const IGT_SOLUTIONS_CATALOG = {
  source: 'igtsolutions',
  companyName: 'IGT Solutions',
  adapter: 'script',
  modulePath: '../../scraper/igtsolutions/script.js',
  companyCareerPage: 'https://atain.com/careers/',
  companyDomain: 'atain.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-careers-page-plus-join-form-and-legacy-board-unavailable-validation',
  extractionStrategy: 'verified-careers-page+verified-join-form+verified-legacy-board-unavailable-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary:
    'Verified on August 2, 2026 that https://atain.com/careers/ is the live first-party careers page for the former IGT Solutions brand, that its recruiting CTA still points to the first-party join form at https://atain.com/join-the-squad/, and that the legacy public ATS hosts at https://careers.igtsolutions.com/ and https://careers.igtsolutions.com/go/India/8956655/ now redirect to SAP\'s recruiting-software marketing page rather than a usable public jobs board. There is still no trustworthy public jobs surface.',
}

export default IGT_SOLUTIONS_CATALOG

