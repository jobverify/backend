import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AKER_SOLUTIONS_INDIA_CATALOG = {
  source: 'akersolutionsindia',
  companyName: 'Aker Solutions India',
  adapter: 'script',
  companyCareerPage: 'https://www.akersolutions.com/careers/',
  companyDomain: 'akersolutions.com',
  atsPlatform: 'first-party-careers-plus-successfactors-apply-handoff',
  countryFilter: 'India',
  paginationStrategy: 'first-party-careers-landing-plus-embedded-job-search-json',
  extractionStrategy:
    'verified-careers-landing+embedded-job-list-json+india-detail-pages+successfactors-apply-handoff',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  homepageUrl: 'https://www.akersolutions.com/',
  jobSearchUrl: 'https://www.akersolutions.com/careers/job-search/',
  verifiedIndiaJobUrl: 'https://www.akersolutions.com/careers/job-search?jobPostId=21793',
  successFactorsApplyHost: 'https://career2.successfactors.eu',
  successFactorsCompanyToken: 'akersoluti',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://www.akersolutions.com/careers/ is the live first-party careers landing page, https://www.akersolutions.com/careers/job-search/ is the public first-party job-search page with 38 vacancies and an India filter, and https://www.akersolutions.com/careers/job-search?jobPostId=21793 is a live Mumbai, India detail page whose Apply button hands off to https://career2.successfactors.eu/sfcareer/jobreqcareer?jobId=21793&company=akersoluti.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default AKER_SOLUTIONS_INDIA_CATALOG
