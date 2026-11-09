export const provider = {
  source: 'ranosys',
  companyName: 'Ranosys Technologies',
  officialBrandName: 'Ranosys',
  adapter: 'script',
  modulePath: '../../scraper/ranosys/script.js',
  homepageUrl: 'https://www.ranosys.com/index.php/career/',
  companyCareerPage: 'https://www.ranosys.com/global/about-us/career/current-openings/',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-current-openings-table',
  extractionStrategy: 'verified-first-party-career-landing+verified-global-current-openings-table',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'ranosys.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.ranosys.com/index.php/career/ is the live first-party Ranosys career landing page and that its Current Openings CTA leads to the first-party table at https://www.ranosys.com/global/about-us/career/current-openings/, which lists India openings in Jaipur such as Software Engineer - Salesforce and QA Engineer - Salesforce.',
  dryRunFile: 'ranosys/jobs.json',
}

export default provider

