export const INNOVAL_DIGITAL_SOLUTIONS_CATALOG = {
  source: 'innovaldigitalsolutions',
  companyName: 'Innoval Digital Solutions',
  officialBrandName: 'Innoval Digital Solutions',
  adapter: 'script',
  modulePath: '../../scraper/innovaldigitalsolutions/script.js',
  companyCareerPage: 'https://career.ivldsp.in/portal/',
  companyPageUrl: 'https://www.ivldsp.com/company/?tab=careers',
  companyDomain: 'ivldsp.com',
  atsPlatform: 'official-company-careers-portal',
  countryFilter: 'India',
  paginationStrategy: 'complete-server-rendered-job-cards-no-pagination',
  extractionStrategy: 'verified-company-client-cta+secure-portal-redirect+all-cards-and-application-details+active-india',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-09',
  verifiedSurfaceSummary: 'Verified the current first-party company Careers tab links Explore Current Openings through its public client application and secure redirect to https://career.ivldsp.in/portal/. The complete server-rendered cards expose public detail and application forms; every card, ID, detail link and detail record is reconciled before selecting active India openings. The portal publishes no numeric total or pagination control; missing rows or newly introduced pagination fail closed.',
  dryRunFile: 'innovaldigitalsolutions/jobs.json',
}

export default INNOVAL_DIGITAL_SOLUTIONS_CATALOG
