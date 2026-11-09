import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Revalidated on Saturday, August 1, 2026 that https://www.riministreet.com/company/careers/ remains the first-party Rimini Street careers entry point when accessible, continues to hand off See open positions into Workday, and that the canonical public Workday board now resolves to https://riministreet.wd1.myworkdayjobs.com/RiminiStreet with tenant riministreet, site RiminiStreet, and live Hyderabad openings including DevOps Engineer, Data Loss Prevention Analyst, ServiceNow Developer, and Sr. QA Engineer, SAP.'

export const RIMINI_STREET_CATALOG = {
  source: 'riministreet',
  companyName: 'Rimini Street',
  officialBrandName: 'Rimini Street',
  adapter: 'script',
  companyCareerPage: 'https://www.riministreet.com/company/careers/',
  officialCareersPageUrl: 'https://www.riministreet.com/company/careers/',
  officialWorkdayBoardUrl: 'https://riministreet.wd1.myworkdayjobs.com/RiminiStreet',
  companyDomain: 'riministreet.com',
  atsPlatform: 'workday',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-handoff-plus-workday-india-filter',
  extractionStrategy:
    'verified-first-party-careers-page+verified-workday-handoff+shared-workday-runner',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-01',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'riministreet.workday/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default RIMINI_STREET_CATALOG
