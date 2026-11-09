export const JUPITER_MONEY_CATALOG = {
  source: 'jupitermoney',
  companyName: 'Jupiter Money',
  officialBrandName: 'Jupiter Money',
  adapter: 'script',
  modulePath: '../../scraper/jupitermoney/script.js',
  dryRunFile: 'jupitermoney/jobs.json',
  homepageUrl: 'https://jupiter.money/',
  aboutPageUrl: 'https://jupiter.money/about-us/',
  companyCareerPage: 'https://jupiter.money/contact/',
  externalHandoffUrl: 'https://jupiter.keka.com/careers',
  careerPortalInfoUrl: 'https://jupiter.keka.com/careers/api/organization/default/careerportalinfo',
  expectedIdentifier: 'b5279857-cf81-4dde-a215-fc48957ee2b5',
  expectedKekaDomain: 'https://jupiter.keka.com/careers/',
  atsPlatform: 'keka-embed-api',
  countryFilter: 'India',
  paginationStrategy: 'official-contact-page-handoff-plus-single-keka-active-jobs-endpoint',
  extractionStrategy:
    'verified-first-party-contact-page+verified-keka-handoff+embedded-khConfig+keka-careerportalinfo+active-keka-embed-api+jobdetails',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'jupiter.money',
  verifiedOn: '2026-07-16',
  verifiedPublicPostingCount: 13,
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that https://jupiter.money/contact/ is the live first-party Jupiter Money contact page and links Current Openings to https://jupiter.keka.com/careers, that the embedded Keka careers document exposes window.khConfig for the public board, that https://jupiter.keka.com/careers/api/organization/default/careerportalinfo resolves exactly to Jupiter Money, and that the active jobs endpoint currently returns 13 public postings.',
}

export default JUPITER_MONEY_CATALOG

