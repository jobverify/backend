export const provider = {
  source: 'appypie',
  companyName: 'Appy Pie',
  officialBrandName: 'Appy Pie',
  adapter: 'script',
  modulePath: '../../scraper/appypie/script.js',
  homepageUrl: 'https://www.appypie.com/',
  companyCareerPage: 'https://careers.appypie.com/careers',
  atsPlatform: 'wordpress-simple-jobs',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-job-board-page-plus-detail-pages-or-empty-shell',
  extractionStrategy: 'verified-first-party-job-board+detail-page-jsonld+visible-detail-metadata+india-only-filter+zero-openings-fallback',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'careers.appypie.com',
  verifiedOn: '2026-08-01',
  verifiedSurfaceSummary:
    'Verified on Saturday, August 1, 2026 that https://careers.appypie.com/careers remained the live first-party Appy Pie careers page, but the public Current Search shell currently exposed only zero-count filters and no public role detail URLs. The local scraper therefore preserves its detail-page JSON-LD mapping when public roles reappear, while returning an empty result for the verified no-openings state visible on the first-party surface today.',
  dryRunFile: 'appypie/jobs.json',
}

export default provider

