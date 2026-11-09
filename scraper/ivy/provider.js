export const provider = {
  source: 'ivy',
  companyName: 'ivy',
  officialBrandName: 'Ivy Comptech',
  adapter: 'script',
  modulePath: '../ivy/script.js',
  homepageUrl: 'https://ivy.global/',
  companyCareerPage: 'https://ivy.global/',
  contactPageUrl: 'https://ivy.global/contact',
  companyDomain: 'ivy.global',
  atsPlatform: 'official-company-site-blocked-careers-surface',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-contact-plus-blocked-careers-route-validation',
  extractionStrategy: 'verified-ivy-global-homepage+verified-contact-entities+blocked-first-party-careers-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary: 'Verified on Saturday, July 18, 2026 that ivy.global was the shared Ivy Comptech public surface naming Ivy Comptech and Ivy Software Development Services Private Limited on the first-party site, while common careers and jobs routes remained blocked to public access and did not expose an enumerable jobs surface.',
  blockedRouteUrls: [
    'https://ivy.global/careers',
    'http://ivy.global/careers',
    'https://ivy.global/jobs',
    'http://ivy.global/jobs',
  ],
}

export default provider
