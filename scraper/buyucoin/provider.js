export const provider = {
  source: 'buyucoin',
  companyName: 'BuyUcoin',
  officialBrandName: 'BuyUcoin',
  adapter: 'script',
  modulePath: '../../scraper/buyucoin/script.js',
  homepageUrl: 'https://www.buyucoin.com/',
  companyCareerPage: 'https://www.buyucoin.com/career',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy: 'verified-first-party-careers-page+inline-openings+external-apply-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'buyucoin.com',
  verifiedOn: '2026-07-25',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 25, 2026 that https://www.buyucoin.com/career was the live first-party BuyUcoin careers page and that it publicly listed Job Opportunities entries for Software Developer- Node.js, Software Quality Analyst Engineer, Graphic Designer (Fresher), and Digital Media Executiver in Noida, India with outbound Apply Now links.',
  dryRunFile: 'buyucoin/jobs.json',
}

export default provider

