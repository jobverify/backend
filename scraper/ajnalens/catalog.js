import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AJNALENS_CATALOG = {
  source: 'ajnalens',
  companyName: 'AjnaLens',
  officialBrandName: 'AjnaLens',
  adapter: 'script',
  companyCareerPage: 'https://www.ajnalens.com/careers',
  homepageUrl: 'https://www.ajnalens.com/',
  applicationUrl: 'https://www.ajnalens.com/careers',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  sourceScopeComplete: false,
  lifecycleCleanupAllowed: false,
  paginationStrategy: 'paired-own-homepage-and-careers-observations;country-and-application-qualification-held',
  extractionStrategy: 'bounded-original-Responses+active-own-native-title-model-observations;no-programme-hash-pins;unresolved-country-not-India-zero',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'ajnalens.com',
  authoritativeCurrentPublication: true,
  backfillMode: 'live-parser',
  scraperTimeoutMs: 120000,
  verifiedOn: null,
  verifiedPublicJobCount: null,
  verifiedIndiaJobCount: null,
  verifiedSurfaceSummary:
    'Current own public titles and complete literal opening models are retained independently in opening and closing observations. Native createdAt remains a creation date. Authored role workplace countries, application-control binding, full company inventory and cleanup remain unqualified; zero returned jobs is an unresolved coverage gap.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default AJNALENS_CATALOG
