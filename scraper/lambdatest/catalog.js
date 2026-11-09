export const LAMBDATEST_CATALOG = {
  source: 'lambdatest',
  companyName: 'LambdaTest',
  officialBrandName: 'TestMu AI (Formerly LambdaTest)',
  adapter: 'script',
  modulePath: '../../scraper/lambdatest/script.js',
  dryRunFile: 'lambdatest/jobs.json',
  homepageUrl: 'https://www.lambdatest.com/',
  legacyCareersPageUrl: 'https://www.lambdatest.com/careers',
  companyCareerPage: 'https://www.testmuai.com/career/',
  activeJobsApiUrl: 'https://test-backend.lambdatest.com/api/careers-page/active-jobs',
  departmentsApiUrl: 'https://test-backend.lambdatest.com/api/careers-page/org-departments',
  externalJobDetailBaseUrl: 'https://lambdatest.kekahire.com/jobdetails/',
  atsPlatform: 'custom-json-api',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-active-jobs-endpoint',
  extractionStrategy:
    'verified-first-party-careers-page+first-party-active-jobs-api+department-verification+external-keka-jobdetail-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'lambdatest.com',
  verifiedOn: '2026-10-03',
  verifiedPublicPostingCount: 4,
  verifiedIndiaPostingCount: 4,
  verifiedSurfaceSummary:
    'Verified October 3, 2026: https://www.testmuai.com/career/ presents Careers at TestMu AI, Formerly LambdaTest, and its active-jobs and org-departments APIs remain live. The active jobs API returned 4 public postings, all with India locations, including one Noida role identified by its opening text.',
}

export default LAMBDATEST_CATALOG

