import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const EASYREWARDZ_SOFTWARE_SERVICES_CATALOG = {
  source: 'easyrewardzsoftwareservices',
  companyName: 'EasyRewardz Software Services',
  officialBrandName: 'Easyrewardz',
  adapter: 'script',
  homepageUrl: 'https://easyrewardz.com/',
  companyCareerPage: 'https://easyrewardz.com/company/careers/',
  companyDomain: 'easyrewardz.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy: 'verified-first-party-awsm-jobs-listing',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://easyrewardz.com/company/careers/ is the live first-party Easyrewardz careers page. The verified surface exposes public AWSM jobs filters for All Job Category and All Job Location together with visible first-party role cards including Customer Success – KAM – BFSI, .Net Developer, Data Engineer, Lead Data Engineer, Relationship Manager – Sales – BFSI, and SMB -Sales – Popin.',
  dryRunFile: 'easyrewardzsoftwareservices/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default EASYREWARDZ_SOFTWARE_SERVICES_CATALOG
