export const VERIFIED_SURFACE_SUMMARY =
  'Verified on August 2, 2026 that https://www.embibe.com/ is a live consumer SPA shell, that https://www.embibe.com/careers now responds with HTTP 404 while still serving the same first-party SPA shell, that https://www.embibe.com/in-en/home/ and https://www.embibe.com/in-en/contactus/ are live first-party marketing pages, and that https://www.embibe.com/in-en/joinus/ is the live first-party Join Us page. Its first-party page API at https://www.embibe.com/in-en/wp-json/wp/v2/pages/483 exposes employer-brand copy rather than public listings, and the verified crawl surfaces at https://www.embibe.com/in-en/sitemap_index.xml and https://www.embibe.com/in-en/page-sitemap.xml still do not publish careers or jobs URLs. The Join Us page links to the official Darwinbox handoff at https://embibe.darwinbox.in/ms/candidate/careers, and a browser session against the public portal at https://embibe.darwinbox.in/ms/candidatev2/main/careers/allJobs loads the official Embibe candidate experience while its same-origin listing API at https://embibe.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main returns success with job_counts 0. There are currently no public Embibe jobs to ingest, but the verified Darwinbox listing API will surface jobs automatically if openings appear later.'

export const EMBIBE_CATALOG = {
  source: 'embibe',
  companyName: 'Embibe',
  officialBrandName: 'Indiavidual Learning Limited (Embibe)',
  adapter: 'script',
  modulePath: '../../scraper/embibe/script.js',
  rootUrl: 'https://www.embibe.com/',
  rootCareersRouteUrl: 'https://www.embibe.com/careers',
  homepageUrl: 'https://www.embibe.com/in-en/home/',
  contactPageUrl: 'https://www.embibe.com/in-en/contactus/',
  companyCareerPage: 'https://www.embibe.com/in-en/joinus/',
  joinUsApiUrl: 'https://www.embibe.com/in-en/wp-json/wp/v2/pages/483',
  sitemapIndexUrl: 'https://www.embibe.com/in-en/sitemap_index.xml',
  pageSitemapUrl: 'https://www.embibe.com/in-en/page-sitemap.xml',
  officialCareersHandoffUrl: 'https://embibe.darwinbox.in/ms/candidate/careers',
  darwinboxHandoffUrl: 'https://embibe.darwinbox.in/ms/candidate/careers',
  darwinboxOrigin: 'https://embibe.darwinbox.in',
  darwinboxCompanyId: 'main',
  publicAllJobsUrl: 'https://embibe.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  companyDomain: 'embibe.com',
  atsPlatform: 'darwinbox',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-join-us-page-plus-browser-session-darwinbox-pagination',
  extractionStrategy:
    'verified-root-shell+verified-root-careers-shell+verified-marketing-homepage+verified-contact-page+verified-join-us-page+verified-join-us-api+verified-sitemap-surfaces+browser-session-darwinbox-listing-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'embibe/jobs.json',
}

export default EMBIBE_CATALOG

