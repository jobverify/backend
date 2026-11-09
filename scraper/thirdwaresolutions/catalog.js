export const THIRDWARE_SOLUTIONS_CATALOG = {
  source: 'thirdwaresolutions',
  companyName: 'Thirdware Solutions',
  officialBrandName: 'Thirdware',
  companyCareerPage: 'https://www.thirdware.com/',
  companyDomain: 'thirdware.com',
  homepageUrl: 'https://www.thirdware.com/',
  candidateRouteUrls: [
    'https://www.thirdware.com/',
    'https://www.thirdware.com/careers',
    'https://www.thirdware.com/careers/',
    'https://www.thirdware.com/jobs',
  ],
  adapter: 'script',
  atsPlatform: 'official-site-certificate-mismatch-no-public-jobs',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-careers-route-certificate-validation',
  extractionStrategy: 'verified-first-party-route-certificate-mismatch+no-trustworthy-public-jobs-surface-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  modulePath: 'scraper/thirdwaresolutions/script.js',
  verifiedOn: '2026-08-05',
  verifiedSurfaceSummary:
    'Verified on Wednesday, August 5, 2026 that repeated probes to https://www.thirdware.com/ and adjacent first-party careers routes failed with a TLS certificate alt-name mismatch, serving a certificate for aws.carparts-stag.io instead of thirdware.com. Because the official first-party routes are not presenting a trustworthy Thirdware certificate or a stable public jobs surface from this environment, the local provider fails closed and returns no jobs.',
}

export default THIRDWARE_SOLUTIONS_CATALOG
