import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CYNTEXA_CATALOG = {
  source: 'cyntexa',
  companyName: 'Cyntexa',
  officialBrandName: 'Cyntexa',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  homepageUrl: 'https://cyntexa.com/',
  companyCareerPage: 'https://cyntexa.com/careers/',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'bounded-current-own-SSR-cards-and-original-same-role-paired-detail-GETs;company-scope-unverified',
  extractionStrategy: 'current-own-Cyntexa-publisher;typed-India-native-JobPosting-and-actual-role-title-plus-same-native-public-ID-application;partial-roles',
  backfillMode: 'live-parser',
  authoritativeCurrentPublication: true,
  scraperTimeoutMs: 180000,
  sourceScopeComplete: false,
  lifecycleCleanupAllowed: false,
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'cyntexa.com',
  dryRunFile: 'cyntexa/jobs.json',
  verifiedOn: null,
  verifiedPublicJobCount: null,
  verifiedGlobalJobCount: null,
  verifiedIndiaJobCount: null,
  verifiedSurfaceSummary:
    'Current own careers SSR cards and separately read own role pages supply current title, typed workplace country, original native public identifier, hiring brand, authored criteria and dates, and matching same-role public application links. Every record closes independently; missing or contradictory identity/country/employer/application facts remain held. All returned roles are partial. Whole company inventory, legal employing entity, application backend activation and cleanup remain unverified.',
}

export default CYNTEXA_CATALOG
