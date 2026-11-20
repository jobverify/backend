import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Current original own homepage and careers declaration qualify direct observation of the explicitly declared native Factorial board. Original native rows, literal public role links, attributes and location labels are retained twice without historical programme, page, logo or vacancy-roster hash pins. Country, exact role employer, criteria, application, native programme semantics, complete configured inventory and all company channels remain unqualified. No India vacancy, configured/company zero, legal entity, browser activation, application backend or cleanup claim is made.'

export const FUNPLUS_CATALOG = {
  source: 'funplus',
  companyName: 'FunPlus',
  officialBrandName: 'FunPlus',
  adapter: 'script',
  homepageUrl: 'https://funplus.com/',
  companyCareerPage: 'https://funplus.com/careers/',
  jobsBoardUrl: 'https://funplus.factorialhr.com/embed/jobs',
  jobsSitemapUrl: 'https://funplus.factorialhr.com/sitemap.xml',
  sampleDetailUrl: 'https://funplus.factorialhr.com/embed/job_posting/community-manager-intern-298342',
  sampleApplyUrl: 'https://funplus.factorialhr.com/embed/apply/community-manager-intern-298342',
  atsPlatform: 'factorialhr-embed-jobs-html',
  paginationStrategy: 'bounded-current-own-publisher-declaration-and-native-board-opening-closing-observations',
  extractionStrategy: 'current-own-careers-declared-native-board+full-original-native-rows+explicit-unqualified-scope-hold',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'funplus.com',
  authoritativeCurrentPublication: true,
  backfillMode: 'live-parser',
  scraperTimeoutMs: 180000,
  verifiedOn: null,
  verifiedPublicJobCount: null,
  verifiedGlobalJobCount: null,
  verifiedIndiaJobCount: null,
  sourceScopeComplete: false,
  lifecycleCleanupAllowed: false,
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  modulePath: path.join(currentDir, 'script.js'),
}

export default FUNPLUS_CATALOG
