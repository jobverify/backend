import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const EXA_CATALOG = {
  source: 'exa',
  companyName: 'Exa',
  officialBrandName: 'Exa',
  legalEntityName: 'Exa Labs Inc.',
  adapter: 'script',
  officialHomepageUrl: 'https://exa.ai/',
  companyCareerPage: 'https://exa.ai/careers',
  verifiedCareersBundleUrl: 'https://exa.ai/_next/static/chunks/app/careers/page-081cdf0c040ae1c4.js',
  ashbyPublicBoardUrl: 'https://jobs.ashbyhq.com/exa',
  ashbyJobBoardUrl: 'https://api.ashbyhq.com/posting-api/job-board/exa',
  officialJobDetailExampleUrl: 'https://jobs.ashbyhq.com/exa/41eb773d-9909-422c-b6b8-5bbdc407d318',
  companyDomain: 'exa.ai',
  atsPlatform: 'ashby',
  countryFilter: 'India',
  paginationStrategy:
    'verified-first-party-careers-page-plus-static-jobs-bundle-plus-public-ashby-job-board',
  extractionStrategy:
    'verified-careers-page+verified-first-party-jobs-bundle+ashby-job-board-api+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://exa.ai/careers is the live first-party Exa careers page, that it loads the current careers bundle at https://exa.ai/_next/static/chunks/app/careers/page-081cdf0c040ae1c4.js, and that the verified bundle links directly to the public Ashby board at https://jobs.ashbyhq.com/exa with the companion API at https://api.ashbyhq.com/posting-api/job-board/exa. The verified first-party bundle and Ashby surface exposed roles only for San Francisco, New York City, and Singapore, so there were no India roles live at verification time.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default EXA_CATALOG
