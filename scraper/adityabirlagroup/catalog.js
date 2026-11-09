import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ADITYA_BIRLA_GROUP_CATALOG = {
  source: 'adityabirlagroup',
  companyName: 'Aditya Birla Group',
  adapter: 'script',
  companyCareerPage: 'https://careers.adityabirla.com/',
  companyDomain: 'adityabirla.com',
  atsPlatform: 'official-aditya-birla-native-api',
  countryFilter: 'India',
  paginationStrategy: 'native-page-index-pagination-with-organisation-counts-terminal-page-and-closing-comparison',
  extractionStrategy:
    'public-page-token+unfiltered-group-api+native-full-detail-model+explicit-country-hierarchy+full-criteria+retained-unqualified-observations',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  homepageUrl: 'https://www.adityabirla.com/',
  jobSearchUrl: 'https://careers.adityabirla.com/job-search',
  uploadCvUrl: 'https://abgcareers.peoplestrong.com/register',
  verifiedOn: null,
  verifiedPublicJobCount: null,
  verifiedIndiaJobCount: null,
  sourceScopeComplete: false,
  verifiedSurfaceSummary:
    'Current https://www.adityabirla.com/ and https://careers.adityabirla.com/ bind the first-party recruiting surface at https://careers.adityabirla.com/job-search. The visible zero-job shell is client initialization. Runtime reads the anonymous token published in page props, enumerates the unfiltered native API with independent organisation counts and a terminal page, checks the native full role renderer, retains original publication/closure precision and own-country hierarchy, projects full public criteria, retains every unqualified observation and compares closing inventory. All counts are runtime evidence; missing criteria or scope gaps never authorize empty inventory or cleanup.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default ADITYA_BIRLA_GROUP_CATALOG
