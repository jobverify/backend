export const JOYALUKKAS_CATALOG = {
  source: 'joyalukkas',
  companyName: 'Joyalukkas',
  officialBrandName: 'Joyalukkas',
  adapter: 'script',
  modulePath: '../../scraper/joyalukkas/script.js',
  dryRunFile: 'joyalukkas/jobs.json',
  homepageUrl: 'https://www.joyalukkas.com/',
  companyCareerPage: 'https://b2b.joyalukkas.com/contact',
  officialCareersPageUrl: 'https://b2b.joyalukkas.com/contact',
  companyDomain: 'joyalukkas.com',
  atsPlatform: 'official-first-party-surface-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-contact-page-validation',
  extractionStrategy:
    'verified-first-party-india-contact-surface-without-public-careers-or-job-feed+return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-25',
  verifiedPublicPostingCount: 0,
  verifiedSurfaceSummary:
    'Verified on Saturday, July 25, 2026 that https://b2b.joyalukkas.com/contact is an official Joyalukkas India Limited first-party surface listing Indian offices and contact details, but it exposes no trustworthy public careers page, ATS handoff, or enumerable India job feed. This provider is intentionally fail-closed and returns no jobs until Joyalukkas publishes a verifiable first-party openings surface.',
}

export default JOYALUKKAS_CATALOG

