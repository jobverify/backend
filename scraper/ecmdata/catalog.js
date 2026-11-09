export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://ecmdata.com/, https://www.ecmdata.com/, https://ecmdata.com/careers, https://www.ecmdata.com/careers, https://ecmdata.com/jobs, https://www.ecmdata.com/jobs, https://ecmdata.com/robots.txt, and https://www.ecmdata.com/robots.txt each returned Cloudflare 522 during live checks, while https://ecmdata.in/, https://www.ecmdata.in/, https://ecmdata.co.in/, https://www.ecmdata.co.in/, https://ecmdataindia.com/, and https://www.ecmdataindia.com/ did not resolve. Bing exact-phrase result feeds for ECM Data returned only enterprise-content-management acronym results rather than a company-owned surface. No trustworthy public first-party jobs surface was reachable for ECM Data.'

export const ECM_DATA_CATALOG = {
  source: 'ecmdata',
  companyName: 'ECM Data',
  adapter: 'script',
  modulePath: '../../scraper/ecmdata/script.js',
  companyCareerPage: 'https://ecmdata.com/',
  companyDomain: 'ecmdata.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'exact-name-domain-cloudflare-522-plus-unresolved-india-variant-validation',
  extractionStrategy:
    'verified-exact-name-domain-routes-return-cloudflare-522-plus-unresolved-india-variant-hosts-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default ECM_DATA_CATALOG

