export const provider = {
  source: 'tarentotechnologies',
  companyName: 'Tarento Technologies',
  officialBrandName: 'Tarento',
  adapter: 'script',
  modulePath: '../../scraper/tarentotechnologies/script.js',
  homepageUrl: 'https://www.tarento.com/',
  companyCareerPage: 'https://www.tarento.com/careers/',
  atsPlatform: 'official-careers-challenge-page-no-structured-public-jobs',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-validation',
  extractionStrategy: 'verified-first-party-careers-challenge-copy+mailto-contact-only+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'tarento.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.tarento.com/careers/ remained Tarento\'s first-party careers page, surfaced the Mobile Interaction Design and Design a Clock Application challenge cards, and directed candidates to careers@tarento.com instead of publishing structured public job cards or role-detail pages. Because the live surface is challenge-and-contact driven rather than a trustworthy public openings feed, this provider remains fail-closed.',
  dryRunFile: 'tarentotechnologies/jobs.json',
}

export default provider

