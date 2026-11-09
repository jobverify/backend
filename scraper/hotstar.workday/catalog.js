import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Monday, August 17, 2026 that https://www.hotstar.com/ still resolves to the official JioHotstar homepage, that https://www.jiostar.com/ currently returns the live JioStar corporate page with a public Workday careers handoff to https://jiostar.wd102.myworkdayjobs.com/JioStar, and that the public JioStar Workday board at https://jiostar.wd102.myworkdayjobs.com/JioStar remains live. Verified that the public Workday jobs API at https://jiostar.wd102.myworkdayjobs.com/wday/cxs/jiostar/JioStar/jobs returns 96 keyword matches when queried with searchText=JioHotstar, including https://jiostar.wd102.myworkdayjobs.com/JioStar/job/Bengaluru---EGL/Senior-Director---Marketing--JioHotstar--South-_JR12076 and its public apply URL. Also verified that legacy tech-jobs.hotstar.com is not a trustworthy active public board.'

export const HOTSTAR_CATALOG = {
  source: 'hotstar',
  companyName: 'Hotstar',
  officialBrandName: 'JioHotstar',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'hotstar.workday/jobs.json',
  homepageUrl: 'https://www.hotstar.com/',
  companyCareerPage: 'https://www.jiostar.com/',
  officialWorkdayBoardUrl: 'https://jiostar.wd102.myworkdayjobs.com/JioStar',
  jobsApiUrl: 'https://jiostar.wd102.myworkdayjobs.com/wday/cxs/jiostar/JioStar/jobs',
  verifiedKeyword: 'JioHotstar',
  verifiedJobUrl:
    'https://jiostar.wd102.myworkdayjobs.com/JioStar/job/Bengaluru---EGL/Senior-Director---Marketing--JioHotstar--South-_JR12076',
  verifiedApplyUrl:
    'https://jiostar.wd102.myworkdayjobs.com/JioStar/job/Bengaluru---EGL/Senior-Director---Marketing--JioHotstar--South-_JR12076/apply',
  companyDomain: 'hotstar.com',
  atsPlatform: 'workday',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-live-careers-page-plus-keyworded-workday-search',
  extractionStrategy:
    'verified-hotstar-brand-homepage+verified-live-jiostar-page+verified-workday-board+keyworded-workday-jobs-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-17',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default HOTSTAR_CATALOG
