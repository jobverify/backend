export const provider = {
  source: 'napierhealthcaresolutions',
  companyName: 'Napier Healthcare Solutions',
  officialBrandName: 'Napier',
  adapter: 'script',
  modulePath: '../../scraper/napierhealthcaresolutions/script.js',
  homepageUrl: 'http://www.napierhealthcare.com/v2/',
  companyCareerPage: 'http://www.napierhealthcare.com/v2/careers/',
  atsPlatform: 'official-company-careers-unavailable',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-route-unavailable-validation',
  extractionStrategy: 'verified-unavailable-first-party-careers-route+typed-upstream-failure',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'napierhealthcare.com',
  verifiedOn: '2026-09-13',
  verifiedSurfaceSummary:
    'Verified on Sunday, September 13, 2026 that the last trusted Napier first-party route http://www.napierhealthcare.com/v2/careers/ now returns HTTP 404, adjacent http://www.napierhealthcare.com/v2/ and http://www.napierhealthcare.com/careers/ routes also return HTTP 404, the bare/root domain redirects to http://www.thetransformationhub.com.au/, and the https variants still fail with certificate-expired errors. This scraper now reports typed upstream_unavailable instead of returning [] until a trustworthy Napier public jobs surface reappears.',
  dryRunFile: 'napierhealthcaresolutions/jobs.json',
}

export default provider

