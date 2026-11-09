import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const INSIGHTSOFTWARE_CATALOG = {
  source: 'insightsoftware',
  companyName: 'insightsoftware',
  officialBrandName: 'insightsoftware',
  adapter: 'script',
  homepageUrl: 'https://insightsoftware.com/',
  companyCareerPage: 'https://insightsoftware.com/careers/',
  workdayTenantHost: 'https://magnitudesoftware.wd1.myworkdayjobs.com/',
  officialWorkdayBoardUrl: 'https://magnitudesoftware.wd1.myworkdayjobs.com/External',
  atsPlatform: 'workday',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-shell-plus-shared-workday-runner',
  extractionStrategy: 'verified-first-party-careers-shell+verified-workday-shell+shared-workday-runner',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'insightsoftware.com',
  verifiedOn: '2026-08-01',
  verifiedSurfaceSummary:
    'Revalidated on Saturday, August 1, 2026 that https://insightsoftware.com/careers/ remained the live first-party insightsoftware careers shell, that it could currently render Current Job Openings while showing 0 of 0 and no job openings available at the moment or intermittently return a CloudFront edge timeout to automation, and that the direct public Workday board at https://magnitudesoftware.wd1.myworkdayjobs.com/External remained live with India openings including HR Business Partner, Lead Software Engineer, Senior Database Administrator, and Lead/Manager.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'insightsoftware.workday/jobs.json',
}

export default INSIGHTSOFTWARE_CATALOG
