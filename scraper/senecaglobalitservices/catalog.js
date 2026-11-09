import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SENECA_GLOBAL_IT_SERVICES_CATALOG = {
  source: 'senecaglobalitservices',
  companyName: 'Seneca Global IT Services',
  officialBrandName: 'SenecaGlobal IT Services Private Limited',
  adapter: 'script',
  companyCareerPage: 'https://www.senecaglobal.com/careers/india-careers/',
  verifiedJobDetailUrls: [
    'https://www.senecaglobal.com/india-careers/senior-qa-lead/',
    'https://www.senecaglobal.com/india-careers/senior-web-publisher/',
  ],
  companyDomain: 'senecaglobal.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-job-list-page',
  extractionStrategy: 'verified-india-careers-page+same-domain-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary:
    'Verified on Tuesday, August 4, 2026 that https://www.senecaglobal.com/careers/india-careers/ is the live first-party SenecaGlobal India careers page and that same-domain detail pages such as Senior QA Lead, Senior Web Publisher, Scrum Master, Associate UX Designer, and Senior Site Reliability Engineer remain public on https://www.senecaglobal.com/india-careers/.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'senecaglobalitservices/jobs.json',
}

export default SENECA_GLOBAL_IT_SERVICES_CATALOG
