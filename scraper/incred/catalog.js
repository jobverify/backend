export const INCRED_CATALOG = {
  source: 'incred', companyName: 'InCred', officialBrandName: 'InCred Financial Services',
  adapter: 'script', modulePath: '../incred/script.js', dryRunFile: 'incred/jobs.json',
  companyCareerPage: 'https://incred.com/Career-Page/', companyDomain: 'incred.com',
  atsPlatform: 'first-party-careers-unverified-inventory',
  paginationStrategy: 'no-verified-complete-native-inventory',
  extractionStrategy: 'bounded-fresh-native-careers-check+typed-coverage-gap',
  parser: 'custom-script', normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-23', verifiedPublicJobCount: null, verifiedIndiaJobCount: null,
  contactEmails: ['jobs@incred.com', 'tech.jobs@incred.com'],
  verifiedSurfaceSummary: 'October 23, 2026: the official InCred Financial Services careers page server-renders No Current Opening before its dynamic native inventory has loaded. The reviewed native client POSTs https://api.turbohire.co/api/careerpagejobs and filters Result locally by company. Its actual browser-native request returned HTTP 401 Authorization denied while the page retained the empty-looking sentinel. Group company tabs, jobs@incred.com, tech.jobs@incred.com and LinkedIn job updates are advertised. Runtime validates the fresh official page and reports a typed coverage gap with unknown public and India counts. The loading/error sentinel cannot certify a real empty inventory.',
}
export default INCRED_CATALOG
