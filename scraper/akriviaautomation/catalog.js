import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AKRIVIA_AUTOMATION_CATALOG = {
  source: 'akriviaautomation',
  companyName: 'Akrivia Automation',
  adapter: 'script',
  companyCareerPage: 'https://www.akrivia.in/career/jobs/careers.html',
  companyDomain: 'akrivia.in',
  atsPlatform: 'official-company-careers-form',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-form-page',
  extractionStrategy: 'verified-careers-form+inline-job-select-options+same-page-application-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.akrivia.in/career/jobs/careers.html remained the exact-name first-party careers form for Akrivia Automation and that its public Job select exposed UI/UX Designer, SEO, and Backend Developer alongside obvious template placeholders such as Job Title 4 and More Jobs Here. The scraper keeps only the non-placeholder public job options and uses the same-page application form as the apply surface.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default AKRIVIA_AUTOMATION_CATALOG
