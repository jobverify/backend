export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://www.firstcry.com/ is the live FirstCry first-party homepage and its footer careers section labels https://www.firstcry.com/careers as "Current Openings at FirstCry.com". Verified that https://www.firstcry.com/careers is the live first-party careers page, but it is only an informational employer-branding surface with "working at firstcry.com" department blurbs for Design, Marketing, Product, and Technology plus colleague testimonials, and it exposes no trustworthy public jobs surface, no public role cards, no job detail pages, and no public ATS handoff.'

export const FIRSTCRY_CATALOG = {
  source: 'firstcry',
  companyName: 'FirstCry',
  adapter: 'script',
  modulePath: '../../scraper/firstcry/script.js',
  homepageUrl: 'https://www.firstcry.com/',
  companyCareerPage: 'https://www.firstcry.com/careers',
  companyDomain: 'firstcry.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-footer-link-plus-informational-careers-page-no-public-jobs',
  extractionStrategy:
    'verified-homepage-footer-link+verified-informational-careers-page-without-public-listings-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default FIRSTCRY_CATALOG

