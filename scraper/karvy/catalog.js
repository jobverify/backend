export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Thursday, August 13, 2026 that the exact-name Karvy domain at https://www.karvy.com/ now resolves to a Porkbun for-sale marketplace without public jobs, while both https://www.karvyonline.com/ and https://www.karvyonline.com/join-us/career/ return the same JavaScript redirect shell to /lander. The parked page at https://www.karvyonline.com/lander is a GoDaddy-style parking lander with no trustworthy public jobs surface. The scraper still tolerates the older Karvy Online homepage and stale resume-only career page when those legacy surfaces reappear without public job listings.'

export const KARVY_CATALOG = {
  source: 'karvy',
  companyName: 'Karvy',
  officialBrandName: 'Karvy',
  adapter: 'script',
  modulePath: '../../scraper/karvy/script.js',
  dryRunFile: 'karvy/jobs.json',
  homepageUrl: 'https://www.karvy.com/',
  parkedHomepageUrls: [
    'https://karvy.com/',
    'https://www.karvy.com/',
  ],
  legacyHomepageUrl: 'https://www.karvyonline.com/',
  companyCareerPage: 'https://www.karvyonline.com/join-us/career/',
  companyDomain: 'karvy.com',
  legacyCompanyDomain: 'karvyonline.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy:
    'inactive-exact-domain-plus-first-party-legacy-root-handoff-plus-stale-resume-page-validation',
  extractionStrategy:
    'verified-exact-name-domain-not-jobs+verified-legacy-redirect-shell-and-parked-lander+legacy-first-party-root-and-stale-resume-page-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-13',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default KARVY_CATALOG
