export const provider = {
  source: 'techversantinfotech',
  companyName: 'Techversant Infotech',
  officialBrandName: 'Techversant Infotech',
  adapter: 'script',
  modulePath: '../../scraper/techversantinfotech/script.js',
  homepageUrl: 'https://techversantinfotech.com/',
  companyCareerPage: 'https://techversantinfotech.com/jobs/',
  atsPlatform: 'wordpress-job-openings',
  countryFilter: 'India',
  paginationStrategy: 'first-party-jobs-archive-pagination',
  extractionStrategy: 'verified-first-party-jobs-archive+paginated-public-opening-cards',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'techversantinfotech.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://techversantinfotech.com/jobs/ is the live first-party Techversant Infotech jobs archive, that it exposes paginated public opening cards with detail links on the same domain, and that page 1 includes roles such as Technical Lead - Java and Data Engineer.',
  dryRunFile: 'techversantinfotech/jobs.json',
}

export default provider

