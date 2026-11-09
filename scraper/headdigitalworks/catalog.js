export const HEAD_DIGITAL_WORKS_CATALOG = {
  source: 'headdigitalworks',
  companyName: 'Head Digital Works',
  officialBrandName: 'Head Digital Works',
  adapter: 'script',
  modulePath: '../../scraper/headdigitalworks/script.js',
  companyCareerPage: 'https://hdworks.in/join-our-team/',
  companyDomain: 'hdworks.in',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-careers-page-plus-stale-external-handoff-validation',
  extractionStrategy:
    'verified-first-party-careers-page+verified-stale-openings-copy+missing-lever-handoff-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that https://hdworks.in/join-our-team/ is the live first-party Head Digital Works careers page and still exposes the stale "Explore Opportunites" and "Can\'t find your perfect fit?" recruiting copy. There is no trustworthy public jobs surface: the linked public Lever board at https://jobs.lever.co/hdworks currently resolves to a missing-board 404 shell, and the public Lever postings API at https://api.lever.co/v0/postings/hdworks?mode=json returned 404 during live checks.',
  dryRunFile: 'headdigitalworks/jobs.json',
}

export default HEAD_DIGITAL_WORKS_CATALOG

