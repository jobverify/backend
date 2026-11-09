import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MINTIFI_CATALOG = {
  source: 'mintifi',
  companyName: 'Mintifi',
  officialBrandName: 'Mintifi',
  adapter: 'script',
  companyCareerPage: 'https://mintifi.com/careers',
  officialHomepageUrl: 'https://mintifi.com/',
  kekaCareerPageUrl: 'https://mintifi.keka.com/careers/',
  kekaCareerPortalInfoUrl: 'https://mintifi.keka.com/careers/api/organization/default/careerportalinfo',
  kekaActiveJobsUrl:
    'https://mintifi.keka.com/careers/api/embedjobs/default/active/0bdc40eb-1cda-4070-83e9-cd5c222a6399',
  expectedKekaIdentifier: '0bdc40eb-1cda-4070-83e9-cd5c222a6399',
  expectedKekaDomain: 'https://mintifi.keka.com/careers/',
  expectedPortalName: 'Mintifi',
  atsPlatform: 'keka-embed-api',
  countryFilter: 'India',
  paginationStrategy: 'first-party-careers-page-plus-single-keka-active-jobs-endpoint',
  extractionStrategy:
    'current-first-party-Keka-configuration+declared-renderer+native-account+full-active-records+all-typed-India-placements',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'mintifi.com',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that https://mintifi.com/careers is the live first-party Mintifi careers page and that it embeds the public Keka board rooted at https://mintifi.keka.com/careers/. Live verification on July 16, 2026 confirmed https://mintifi.keka.com/careers/api/organization/default/careerportalinfo and https://mintifi.keka.com/careers/api/embedjobs/default/active/0bdc40eb-1cda-4070-83e9-cd5c222a6399 returning the public Mintifi careers portal with active public India openings including Sales Manager - Retail, Compliance Manager, and Internal Audit Intern.',
  dryRunFile: 'mintifi/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default MINTIFI_CATALOG
