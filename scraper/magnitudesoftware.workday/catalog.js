import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MAGNITUDE_SOFTWARE_CATALOG = {
  source: 'magnitudesoftware',
  companyName: 'Magnitude Software',
  officialBrandName: 'Magnitude Software',
  adapter: 'script',
  homepageUrl: 'https://www.magnitude.com/',
  companyCareerPage: 'https://insightsoftware.com/careers/',
  redirectCompanyUrl: 'https://insightsoftware.com/magnitude/',
  parentCompanyName: 'insightsoftware',
  workdayTenantHost: 'https://magnitudesoftware.wd1.myworkdayjobs.com/',
  officialWorkdayBoardUrl: 'https://magnitudesoftware.wd1.myworkdayjobs.com/External',
  atsPlatform: 'workday',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-redirect-plus-shared-workday-runner',
  extractionStrategy:
    'verified-magnitude-homepage-redirect+verified-first-party-careers-shell+verified-workday-shell+shared-workday-runner',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'magnitude.com',
  verifiedOn: '2026-08-01',
  verifiedSurfaceSummary:
    'Revalidated on Saturday, August 1, 2026 that https://www.magnitude.com/ still resolved to https://insightsoftware.com/magnitude/, that the redirected first-party page still stated Magnitude is now part of insightsoftware and linked Careers to https://insightsoftware.com/careers/, that the current insightsoftware careers shell still rendered Current Job Openings while showing 0 of 0 and no job openings available at the moment, and that the direct public Workday board at https://magnitudesoftware.wd1.myworkdayjobs.com/External remained live with India openings including HR Business Partner, Lead Software Engineer, and Senior Database Administrator.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'magnitudesoftware.workday/jobs.json',
}

export default MAGNITUDE_SOFTWARE_CATALOG
