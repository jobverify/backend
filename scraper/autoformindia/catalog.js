export const VERIFIED_SURFACE_SUMMARY =
  'Verified November 3, 2026: https://www.autoform.com/en/ binds AutoForm Engineering to https://careers.autoform.com/en/ and https://careers.autoform.com/en/jobs/job-search/. Runtime reconciles advertised listing channels, pagination, both first-party RSS feeds, same-ID native details and closing workplace identities. Four current roles are observed. One has conflicting work countries, Netherlands versus Germany; both are explicitly non-India, so configured India absence is independently proved without choosing an exact foreign country. Full native criteria and every word/punctuation remain retained; a native single-space description formatting difference does not remove criteria. Unknown/India workplace alternatives, unbound identities, enumeration/closing gaps and caps keep India inventory partial. Exact global-detail conflicts, company-wide scope and lifecycle cleanup remain unproved.'

export const AUTOFORM_INDIA_CATALOG = {
  source: 'autoformindia',
  companyName: 'AutoForm India',
  officialBrandName: 'AutoForm Engineering',
  adapter: 'script',
  modulePath: '../../scraper/autoformindia/script.js',
  companyCareerPage: 'https://careers.autoform.com/en/jobs/job-search/',
  homepageUrl: 'https://www.autoform.com/en/',
  careersHomeUrl: 'https://careers.autoform.com/en/',
  jobsLandingUrl: 'https://careers.autoform.com/en/jobs/',
  jobsRssUrl: 'https://careers.autoform.com/en/jobs.rss',
  companyDomain: 'autoform.com',
  atsPlatform: 'official-typo3-native-listing-rss-and-details',
  countryFilter: 'India',
  paginationStrategy: 'all-advertised-native-listing-pages-next-links-and-closing-recheck',
  extractionStrategy:
    'current-corporate-handoff+native-listing-rss-reconciliation+full-native-details+explicit-role-countries+closing-recheck',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-11-03',
  zeroResultPolicy: 'evidence-required',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default AUTOFORM_INDIA_CATALOG

