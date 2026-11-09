export const STACKPATH_CATALOG = {
  source: 'stackpath',
  companyName: 'StackPath',
  officialBrandName: 'StackPath',
  adapter: 'script',
  modulePath: '../../scraper/stackpath/script.js',
  dryRunFile: 'stackpath/jobs.json',
  companyCareerPage: 'https://www.stackpath.com/',
  companyDomain: 'stackpath.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'exact-name-first-party-root-plus-common-careers-route-validation',
  extractionStrategy:
    'verified-exact-name-first-party-root-empty-shell+verified-common-careers-routes-404-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-25',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 25, 2026 that https://www.stackpath.com/ was the live exact-name first-party StackPath host and returned a tiny 200 shell with the distinctive dark #0a0100 background plus empty centered heading blocks, but no careers copy, no job cards, no ATS handoff, and no trustworthy public openings surface. Also verified on Saturday, July 25, 2026 that https://www.stackpath.com/careers, https://www.stackpath.com/jobs, and https://www.stackpath.com/about/careers all returned first-party 404 pages with the visible "404 ERROR" heading and "Sorry the page you are looking is no longer here." copy. This provider therefore returns an honest empty result until StackPath exposes a trustworthy public first-party jobs surface.',
}

export default STACKPATH_CATALOG

