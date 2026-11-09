export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://www.airtelxlabs.com/ is the live Airtel X Labs branded site and hands off via a frameset to https://www.airtel.in/careers/airtelxlabs/, which currently resolves to the generic Airtel careers shell at https://careers.airtel.com/. https://www.airtelxlabs.com/careers and https://www.airtelxlabs.com/jobs returned 404, while https://www.airtel.in/careers/airtelxlabs/jobs and https://www.airtel.in/careers/airtelxlabs/openings also resolved to the same generic Airtel careers page. There is no trustworthy public jobs surface: the verified first-party routes only point to a generic Airtel careers board without Airtel X Labs-specific listings or filters.'

export const AIRTEL_X_LABS_CATALOG = {
  source: 'airtelxlabs',
  companyName: 'Airtel X Labs',
  officialBrandName: 'Airtel X Labs',
  adapter: 'script',
  modulePath: '../../scraper/airtelxlabs/script.js',
  brandedHomepageUrl: 'https://www.airtelxlabs.com/',
  companyCareerPage: 'https://www.airtel.in/careers/airtelxlabs/',
  parentCareersPage: 'https://careers.airtel.com/',
  companyDomain: 'airtelxlabs.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy:
    'verified-branded-frameset-plus-generic-airtel-careers-handoff-plus-missing-branded-routes',
  extractionStrategy:
    'verified-branded-homepage+verified-generic-airtel-careers-handoff-without-x-labs-jobs+verified-missing-branded-routes+verified-generic-x-labs-subroutes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default AIRTEL_X_LABS_CATALOG

