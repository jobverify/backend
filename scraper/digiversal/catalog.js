export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, August 1, 2026 that https://digiversal.in/ redirects to the live first-party homepage at https://www.digiversal.co/, that https://www.digiversal.co/robots.txt and https://www.digiversal.co/sitemap.xml are live crawl surfaces, and that https://www.digiversal.co/careers/ remains the first-party public careers board. The careers page currently exposes 22 same-domain role cards such as https://www.digiversal.co/careers/academic-research-mentor, https://www.digiversal.co/careers/digital-marketing-executive, and https://www.digiversal.co/careers/android-developer; the digital marketing detail page now titles itself "Digital Marketing Executive | SEO Executive - Digiversal" while still exposing the expected Apply Now, Responsibilities, Project Location(s), and Experience sections. https://www.digiversal.co/career, https://www.digiversal.co/jobs, https://www.digiversal.co/join-us, https://www.digiversal.co/openings, and https://www.digiversal.co/current-openings all still returned first-party 404 pages during live checks.'

export const DIGIVERSAL_CATALOG = {
  source: 'digiversal',
  companyName: 'DigiVersal',
  adapter: 'script',
  modulePath: '../../scraper/digiversal/script.js',
  rootUrl: 'https://digiversal.in/',
  homepageUrl: 'https://www.digiversal.co/',
  companyCareerPage: 'https://www.digiversal.co/careers/',
  companyDomain: 'digiversal.co',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-plus-same-domain-detail-pages',
  extractionStrategy:
    'verified-in-root-redirect+verified-homepage-careers-link+verified-careers-listing-cards+same-domain-detail-pages+verified-missing-alternate-job-routes',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-01',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default DIGIVERSAL_CATALOG

