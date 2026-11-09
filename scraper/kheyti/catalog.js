import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 16, 2026 that https://www.kheyti.com/join-us is the official Kheyti join page and that https://jobs.kheyti.com/careers remained the branded public jobs surface. The public Zoho Recruit careers table on that page was live under the Current Job Openings heading with public India openings, including Green House- Product Manager and Farmer Success Associate, and exposed stable PortalDetail job URLs under the same first-party jobs.kheyti.com host.'

export const KHEYTI_CATALOG = {
  source: 'kheyti',
  companyName: 'Kheyti',
  officialBrandName: 'Kheyti',
  adapter: 'script',
  homepageUrl: 'https://www.kheyti.com/',
  companyCareerPage: 'https://jobs.kheyti.com/careers',
  officialJoinPageUrl: 'https://www.kheyti.com/join-us',
  officialJobsPageUrl: 'https://jobs.kheyti.com/careers',
  sampleJobDetailUrl:
    'https://jobs.kheyti.com/recruit/PortalDetail.na?iframe=true&digest=OAklCDTw9J9pswkzjtfSB3GAUnkE7bVo.a85bxdBEmQ-&jobid=484579000019591131&widgetid=484579000000072311&embedsource=CareerSite',
  companyDomain: 'kheyti.com',
  atsPlatform: 'zohorecruit',
  countryFilter: 'India',
  paginationStrategy: 'single-zohorecruit-careers-table-page',
  extractionStrategy:
    'verified-homepage+verified-first-party-join-page+verified-public-zohorecruit-careers-table+detail-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'kheyti/jobs.json',
}

export default KHEYTI_CATALOG
