export const HEADOUT_CATALOG = {
  source: 'headout',
  companyName: 'Headout',
  officialBrandName: 'Headout',
  adapter: 'script',
  modulePath: '../../scraper/headout/script.js',
  companyCareerPage: 'https://www.headout.com/careers/',
  companyDomain: 'headout.com',
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-page-plus-multi-board-greenhouse-jobs-api',
  extractionStrategy:
    'verified-first-party-careers-page+verified-open-roles-loader+multi-board-greenhouse-jobs-api+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  greenhouseBoardSlugs: ['headoutcareers', 'headoutreferrals'],
  verifiedOn: '2026-08-15',
  verifiedSurfaceSummary:
    'Verified on Saturday, August 15, 2026 that https://www.headout.com/careers/ remains the live first-party Headout careers page, that it now loads its open-roles JavaScript chunks from the first-party asset host https://assets.headout.com/hobrandpages/_next/static/chunks/, and that those chunks still reference the public Greenhouse boards headoutcareers and headoutreferrals. The live Greenhouse jobs API still exposes India roles including Analytics Manager, Product in Bengaluru, Associate/Senior Associate, Customer Experience in Remote (India), and Data Analyst in Bengaluru.',
  dryRunFile: 'headout/jobs.json',
}

export default HEADOUT_CATALOG

