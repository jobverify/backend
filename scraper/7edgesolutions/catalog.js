export const SEVEN_EDGE_SOLUTIONS_CATALOG = {
  source: '7edgesolutions',
  companyName: '7Edge Solutions',
  companyCareerPage: 'https://7edge.com/',
  companyDomain: '7edge.com',
  adapter: 'script',
  atsPlatform: 'keka-embed-api',
  countryFilter: 'India',
  paginationStrategy: 'official-homepage-handoff-plus-single-keka-active-jobs-endpoint',
  extractionStrategy: 'verified-official-homepage+verified-keka-handoff+embedded-khConfig+careerportalinfo+active-keka-embed-api+jobdetails+applyjob',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  modulePath: 'scraper/7edgesolutions/script.js',
  verifiedOn: '2026-07-14',
  verifiedSurfaceSummary:
    'Official 7edge.com homepage links Careers to a public 7edge.keka.com careers page whose embedded khConfig and active jobs feed expose India roles.',
  externalHandoffUrl: 'https://7edge.keka.com/careers/',
  expectedIdentifier: '47717352-59ee-46c3-9b43-ac709b076550',
  expectedKekaDomain: 'https://7edge.keka.com/careers/',
}

export default SEVEN_EDGE_SOLUTIONS_CATALOG
