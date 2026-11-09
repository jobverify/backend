export const JADE_GLOBAL_CATALOG = {
  source: 'jadeglobal',
  companyName: 'Jade Global',
  officialBrandName: 'Jade Global',
  adapter: 'script',
  modulePath: '../../scraper/jadeglobal.workday/script.js',
  dryRunFile: 'jadeglobal.workday/jobs.json',
  companyCareerPage: 'https://www.jadeglobal.com/careers',
  workdayBoardUrl: 'https://jadeglobal.wd5.myworkdayjobs.com/Jade_Careers',
  jobsApiUrl: 'https://jadeglobal.wd5.myworkdayjobs.com/wday/cxs/jadeglobal/Jade_Careers/jobs',
  companyDomain: 'jadeglobal.com',
  verifiedPublicJobCount: 261,
  atsPlatform: 'workday',
  countryFilter: 'Global',
  paginationStrategy: 'verified-first-party-careers-page-plus-workday-jobs-api',
  extractionStrategy: 'verified-first-party-careers-page+workday-jobs-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on Thursday, July 16, 2026 that https://www.jadeglobal.com/careers is the live first-party Jade Global careers page and that it links applicants to the public Workday board at https://jadeglobal.wd5.myworkdayjobs.com/Jade_Careers. Verified the corresponding public Workday jobs API at https://jadeglobal.wd5.myworkdayjobs.com/wday/cxs/jadeglobal/Jade_Careers/jobs, which returned 261 live roles on Thursday, July 16, 2026, including public openings such as Lead ServiceNow Developer and Oracle SCM Functional (Oracle Cloud SCM Expert).',
}

export default JADE_GLOBAL_CATALOG

