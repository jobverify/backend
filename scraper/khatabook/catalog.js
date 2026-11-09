export const KHATABOOK_CATALOG = {
  source: 'khatabook',
  companyName: 'Khatabook',
  officialBrandName: 'Khatabook',
  adapter: 'script',
  modulePath: '../../scraper/khatabook/script.js',
  dryRunFile: 'khatabook/jobs.json',
  homepageUrl: 'https://khatabook.com/',
  companyCareerPage: 'https://khatabook.com/en/hiring/',
  careersScriptUrl: 'https://khatabook-assets.s3.amazonaws.com/static/js/hiring.js',
  categoryJobsApiBaseUrl: 'https://khatabook.com/hiring/recruiter/list',
  publicApplyHost: 'https://khatabook.turbohire.co',
  atsPlatform: 'official-careers-page-plus-turbohire-publicjobs',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-page-category-enumeration',
  extractionStrategy:
    'verified-first-party-careers-page+verified-hiring-js+same-origin-category-jobs-endpoint+turbohire-apply-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'khatabook.com',
  verifiedOn: '2026-07-16',
  verifiedPublicPostingCount: 12,
  verifiedSurfaceSummary:
    'Verified on Thursday, July 16, 2026 that https://khatabook.com/en/hiring/ is the live first-party Khatabook careers page, that it exposes category tabs for the public openings view, and that the first-party script at https://khatabook-assets.s3.amazonaws.com/static/js/hiring.js calls the same-origin endpoint https://khatabook.com/hiring/recruiter/list?category=... . Live verification on Thursday, July 16, 2026 confirmed that the endpoint returns structured public job payloads with Khatabook-branded metadata and TurboHire public apply URLs under https://khatabook.turbohire.co/job/publicjobs/ , yielding 12 unique public jobs after deduplication across the official categories.',
}

export default KHATABOOK_CATALOG

