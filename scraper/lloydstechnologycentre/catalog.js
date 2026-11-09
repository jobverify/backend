import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const LLOYDS_TECHNOLOGY_CENTRE_CATALOG = {
  source: 'lloydstechnologycentre',
  companyName: 'Lloyds Technology Centre',
  officialBrandName: 'Lloyds Technology Centre',
  adapter: 'script',
  homepageUrl: 'https://lloydstechnologycentre.com/',
  companyCareerPage: 'https://lloydstechnologycentre.com/',
  officialWorkdayBoardUrl: 'https://lbg.wd3.myworkdayjobs.com/Lloyds_Technology_Centre',
  jobsApiUrl: 'https://lbg.wd3.myworkdayjobs.com/wday/cxs/lbg/Lloyds_Technology_Centre/jobs',
  atsPlatform: 'official-careers-handoff-workday',
  countryFilter: 'India',
  paginationStrategy: 'Workday jobs API offset pagination',
  extractionStrategy: 'verified-first-party-careers-page+verified-workday-handoff+verified-workday-shell+paginated-workday-jobs-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'lloydstechnologycentre.com',
  verifiedOn: '2026-08-03',
  verifiedSurfaceSummary:
    'Verified on Monday, August 3, 2026 that https://lloydstechnologycentre.com/ is the exact Lloyds Technology Centre careers page, that it visibly hands applicants to https://lbg.wd3.myworkdayjobs.com/Lloyds_Technology_Centre through Search and apply links, and that the recovered Workday shell exposes the public paginated jobs API at /wday/cxs/lbg/Lloyds_Technology_Centre/jobs.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default LLOYDS_TECHNOLOGY_CENTRE_CATALOG
