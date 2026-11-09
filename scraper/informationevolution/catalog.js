import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const INFORMATION_EVOLUTION_CATALOG = {
  source: 'informationevolution',
  companyName: 'Information Evolution',
  adapter: 'script',
  companyCareerPage: 'https://informationevolution.com/about#careers',
  companyDomain: 'informationevolution.com',
  jobsPageUrl: 'https://informationevolution.com/about',
  sampleJobUrl: 'https://informationevolution.com/careers/software-developer',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-role-api-plus-detail-pages',
  extractionStrategy: 'current-careers-handoff+public-role-api+native-role-and-application-validation',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-23',
  verifiedSurfaceSummary:
    'On 2026-10-23 the current first-party /about#careers role API advertised Software Developer in Coimbatore, India. Each run validates the current feed, full role schema, geography, description and native application form. Whole-company recruitment scope remains unproven. The historical development host no longer resolves.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'informationevolution/jobs.json',
}

export default INFORMATION_EVOLUTION_CATALOG
