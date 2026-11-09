export const INTEX_TECHNOLOGIES_CATALOG = {
  source: 'intextechnologies',
  companyName: 'Intex Technologies',
  officialBrandName: 'Intex Technologies',
  adapter: 'script',
  modulePath: '../../scraper/intextechnologies/script.js',
  companyCareerPage: 'https://www.intex.in/pages/careers',
  homepageUrl: 'https://www.intex.in/',
  officialCareersPageUrl: 'https://www.intex.in/pages/careers',
  applicationUrl: 'https://forms.gle/8rznvixnmnNB4cnB9',
  companyDomain: 'intex.in',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-page-inline-openings',
  extractionStrategy:
    'verified-first-party-careers-page+inline-opening-cards+shared-google-form-apply-surface',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on Thursday, July 16, 2026 that https://www.intex.in/pages/careers is the live first-party Intex Technologies careers page, that it publicly exposes visible inline openings including Branch Sales Manager and E - Commerce Manager, and that the live page currently hands applicants to the shared Google Forms URL https://forms.gle/8rznvixnmnNB4cnB9.',
  dryRunFile: 'intextechnologies/jobs.json',
}

export default INTEX_TECHNOLOGIES_CATALOG

