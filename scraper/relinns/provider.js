export const provider = {
  source: 'relinns',
  companyName: 'Relinns Technologies',
  officialBrandName: 'Relinns',
  adapter: 'script',
  modulePath: '../../scraper/relinns/script.js',
  homepageUrl: 'https://careers.relinns.com/',
  companyCareerPage: 'https://careers.relinns.com/',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-careers-board-filterable-opening-cards',
  extractionStrategy: 'verified-first-party-careers-board+public-opening-cards+same-domain-apply-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'careers.relinns.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://careers.relinns.com/ is the live first-party Relinns careers board and that it exposes public opening cards with same-domain apply links, including Quality Assurance-Manual and Sales Development Representative.',
  dryRunFile: 'relinns/jobs.json',
}

export default provider

