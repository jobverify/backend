import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const NEWFOLD_DIGITAL_CATALOG = {
  source: 'newfolddigital',
  companyName: 'NewFold Digital',
  officialBrandName: 'NewFold Digital',
  adapter: 'script',
  officialHomepageUrl: 'https://www.newfold.com/',
  companyCareerPage: 'https://www.newfold.com/careers',
  officialWorkdayBoardUrl: 'https://web.wd1.myworkdayjobs.com/ExternalCareerSite',
  jobsApiUrl: 'https://web.wd1.myworkdayjobs.com/wday/cxs/web/ExternalCareerSite/jobs',
  verifiedIndiaLocationNames: [
    'India - Remote',
    'Mumbai, India',
  ],
  companyDomain: 'newfold.com',
  atsPlatform: 'workday',
  countryFilter: 'India',
  paginationStrategy: 'verified-public-workday-board-plus-india-location-facets',
  extractionStrategy:
    'verified-official-careers-page+verified-public-workday-board+unfiltered-workday-jobs-api+india-location-facets+filtered-workday-jobs-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  dryRunFile: 'newfolddigital.workday/jobs.json',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on Thursday, July 16, 2026 that https://www.newfold.com/careers is the official NewFold Digital careers page and hands off Browse Openings to the public Workday board at https://web.wd1.myworkdayjobs.com/ExternalCareerSite. The public Workday jobs API at https://web.wd1.myworkdayjobs.com/wday/cxs/web/ExternalCareerSite/jobs exposed verified India location facets including India - Remote and Mumbai, India, and returned 12 India jobs when filtered to those verified India locations.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default NEWFOLD_DIGITAL_CATALOG
