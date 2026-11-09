import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HINGE_HEALTH_INDIA_CATALOG = {
  source: 'hingehealthindia',
  companyName: 'Hinge Health India',
  officialBrandName: 'Hinge Health',
  adapter: 'script',
  companyCareerPage: 'https://www.hingehealth.com/about/culture-and-engagement/',
  officialCulturePageUrl: 'https://www.hingehealth.com/about/culture-and-engagement/',
  ashbyPublicBoardUrl: 'https://jobs.ashbyhq.com/hinge-health',
  ashbyJobBoardUrl: 'https://api.ashbyhq.com/posting-api/job-board/hinge-health',
  companyDomain: 'hingehealth.com',
  atsPlatform: 'ashby',
  countryFilter: 'India',
  paginationStrategy: 'official-site-handoff-plus-public-ashby-job-board',
  extractionStrategy:
    'verified-official-culture-page-handoff+public-ashby-job-board-api+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on 2026-07-16 that the official Hinge Health page https://www.hingehealth.com/about/culture-and-engagement/ currently hands off career traffic to the public Ashby board at https://jobs.ashbyhq.com/hinge-health, that the public board API is https://api.ashbyhq.com/posting-api/job-board/hinge-health, and that the verified India slice on that date included Bengaluru roles such as Workday System Admin, Product Manager, Senior Software Engineer, and Senior Software Engineer-Backend.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default HINGE_HEALTH_INDIA_CATALOG
