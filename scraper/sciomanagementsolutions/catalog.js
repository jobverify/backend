export const SCIOMS_CATALOG = {
  source: 'sciomanagementsolutions',
  companyName: 'SCIO Management Solutions',
  officialBrandName: 'SCIO',
  companyCareerPage: 'https://scioms.com/careers.php',
  companyDomain: 'scioms.com',
  homepageUrl: 'https://scioms.com/',
  applyUrl: 'https://scioms.com/apply-now.php',
  adapter: 'script',
  atsPlatform: 'official-site-placeholder-shell-no-public-jobs',
  countryFilter: 'India',
  paginationStrategy: 'canonical-placeholder-shell-validation',
  extractionStrategy:
    'verified-home-shell+canonical-careers-apply-routes+lenient-http-parse-recovery+no-public-job-listings-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  modulePath: 'scraper/sciomanagementsolutions/script.js',
  verifiedOn: '2026-08-14',
  verifiedSurfaceSummary:
    'Verified on Friday, August 14, 2026 that https://www.scioms.com/careers.php redirects to the canonical route https://scioms.com/careers.php and https://www.scioms.com/apply-now.php redirects to https://scioms.com/apply-now.php, but both canonical routes now collapse to the same first-party SCIO placeholder shell as https://scioms.com/. Verified that the live shell keeps the title "SCIO Management Solutions - Intelligent, Automated RCM Services", the canonical link https://www.scioms.com/index.php, and only a "Request a Consultation" form with Submit / Close actions. No trustworthy public job detail surface or public position selector is exposed on the verified date.',
}

export default SCIOMS_CATALOG
