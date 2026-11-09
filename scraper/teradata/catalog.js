import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TERADATA_CATALOG = {
  source: 'teradata',
  companyName: 'Teradata',
  officialBrandName: 'Teradata',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  companyCareerPage: 'https://www.teradata.com/about-us/careers',
  companyDomain: 'teradata.com',
  jobsApiUrl: 'https://careers.teradata.com/graphql',
  atsPlatform: 'gr8people-graphql',
  countryFilter: 'India',
  paginationStrategy: 'bounded-persisted-search-pages-and-full-closing-models',
  extractionStrategy: 'current-published-client+complete-native-job-and-JobPosting+own-explicit-country+paired-full-native-models',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-11-05',
  verifiedPublicJobCount: 181,
  verifiedIndiaJobCount: 86,
  verifiedSampleJobTitle: 'Principal Engineer - AI Applications',
  verifiedSampleJobUrl: 'https://careers.teradata.com/jobs/220198/principal-engineer-ai-applications',
  verifiedSurfaceSummary:
    'Observed on November 5, 2026: the active official careers handoff, own native publisher and currently declared public client bind the anonymous searchJobs/search-jobs GraphQL operation. Both pages of 181 current native models and their complete closing records reconcile; 86 own JobPosting records have explicit India addresses and full native criteria. Current place IDs bind secondary countries, with a written-country fallback for own complete workplace labels. Original descriptions, native IDs and timestamp precision are retained. Legal employer, requisition and first-ever publication are not invented. The Hong Kong country-label case remains held. Whole company scope and lifecycle cleanup remain unqualified.',
}

export default TERADATA_CATALOG
