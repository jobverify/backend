import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 18, 2026 that https://www.thedigitalgroup.com/careers?page=1 was the live first-party The Digital Group careers page and rendered a public jobs table with Job ID, Date Posted, Job Title, Location, and Apply links, including visible rows such as Business Analyst, React Developer, Marketing Manager, and AI/MLEngineer.'

export const THE_DIGITAL_GROUP_INFOTECH_CATALOG = {
  source: 'thedigitalgroupinfotech',
  companyName: 'The Digital Group Infotech',
  officialBrandName: 'The Digital Group',
  adapter: 'script',
  homepageUrl: 'https://www.thedigitalgroup.com/',
  companyCareerPage: 'https://www.thedigitalgroup.com/careers?page=1',
  companyDomain: 'thedigitalgroup.com',
  atsPlatform: 'official-company-careers-table',
  countryFilter: 'India',
  paginationStrategy: 'server-rendered-first-party-careers-table',
  extractionStrategy: 'verified-first-party-careers-table-with-detail-and-apply-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedPublicJobCount: 10,
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'thedigitalgroupinfotech/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default THE_DIGITAL_GROUP_INFOTECH_CATALOG
