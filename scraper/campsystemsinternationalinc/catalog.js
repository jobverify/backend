export const CAMP_SYSTEMS_INTERNATIONAL_INC_CATALOG = {
  source: 'campsystemsinternationalinc',
  companyName: 'CAMP Systems International, Inc.',
  officialBrandName: 'CAMP Systems',
  adapter: 'script',
  modulePath: '../../scraper/campsystemsinternationalinc/script.js',
  companyCareerPage: 'https://www.campsystems.com/careers',
  companyDomain: 'campsystems.com',
  atsPlatform: 'ukg-pro',
  countryFilter: 'India',
  paginationStrategy: 'native-unfiltered-search+offset+closing-membership',
  extractionStrategy: 'current-corporate-handoff+anonymous-public-ukg-search+full-bound-role-models',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-11-03',
  verifiedSurfaceSummary:
    'The current https://www.campsystems.com/careers Find Opportunities handoff declares an external UKG board. Enumerate its anonymous unfiltered native search, explicit worksite countries and full public role models, then reconcile corporate binding, details and final listing. This configured board does not establish company-wide inventory or authorize lifecycle cleanup.',
  dryRunFile: 'campsystemsinternationalinc/jobs.json',
}

export default CAMP_SYSTEMS_INTERNATIONAL_INC_CATALOG

