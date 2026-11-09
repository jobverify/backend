export const provider = {
  source: 'valgenesis',
  companyName: 'ValGenesis',
  adapter: 'script',
  modulePath: '../../scraper/valgenesis/script.js',
  companyCareerPage: 'https://www.valgenesis.com/careers',
  atsPlatform: 'official-company-site-no-public-jobs-feed',
  countryFilter: 'India',
  paginationStrategy: 'single-careers-marketing-page-validation',
  extractionStrategy: 'verified-first-party-careers-marketing-page+no-structured-job-listings-or-public-apply-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'valgenesis.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.valgenesis.com/careers remained the first-party ValGenesis careers page, included the Join the team, we\'re hiring! marketing copy, and listed office locations including Chennai, Bengaluru, and Hyderabad. No trustworthy public jobs feed was exposed, along with no structured opening cards or first-party apply links.',
  dryRunFile: 'valgenesis/jobs.json',
}

export default provider

