import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const INFRABEAT_TECHNOLOGIES_CATALOG = {
  source: 'infrabeattechnologies',
  companyName: 'Infrabeat Technologies',
  officialBrandName: 'InfraBeat Technologies Pvt. Ltd.',
  adapter: 'script',
  homepageUrl: 'https://infrabeat.com/',
  companyCareerPage: 'https://infrabeat.com/careers/',
  companyDomain: 'infrabeat.com',
  atsPlatform: 'official-inline-careers-page',
  countryFilter: 'India',
  paginationStrategy: 'single-inline-page',
  extractionStrategy: 'verified-first-party-careers-page+inline-open-position-cards+modal-job-details',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary:
    'Verified on Sunday, August 2, 2026 that https://infrabeat.com/careers/ is the live first-party InfraBeat careers page, that it presents an "Open Positions" section with inline role cards plus modal job details, and that it currently lists Lead SAP MM Consultant, Lead SAP FICO Consultant, Lead SAP EWM Consultant, and SAP FICO Senior Consultant in Pune, India.',
  dryRunFile: 'infrabeattechnologies/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default INFRABEAT_TECHNOLOGIES_CATALOG
