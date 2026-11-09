import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const EXTENTIA_INFORMATION_TECHNOLOGY_CATALOG = {
  source: 'extentiainformationtechnology',
  companyName: 'Extentia Information Technology',
  officialBrandName: 'Extentia',
  adapter: 'script',
  homepageUrl: 'https://www.extentia.com/',
  companyCareerPage: 'https://www.extentia.com/careers/careers-opportunities/',
  companyDomain: 'extentia.com',
  atsPlatform: 'official-first-party-job-links',
  countryFilter: 'India',
  paginationStrategy: 'multi-page-first-party-role-archive',
  extractionStrategy: 'verified-role-archive+detail-links+first-party-more-details-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary:
    'Verified on Sunday, August 2, 2026 that https://www.extentia.com/careers/careers-opportunities/ is the live first-party Extentia role archive, that page 1 exposes public role links including .Net Fullstack Developer, Devops Engineer, and SAP ABAP Developer, and that pagination continues through the first-party page-2 route https://www.extentia.com/careers/careers-opportunities/?e-page-0431873=2 with additional roles including Legal and Compliance Manager and Salesforce Development.',
  dryRunFile: 'extentiainformationtechnology/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default EXTENTIA_INFORMATION_TECHNOLOGY_CATALOG
