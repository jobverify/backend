import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SMARTSTREAM_TECHNOLOGIES_CATALOG = {
  source: 'smartstreamtechnologies',
  companyName: 'SmartStream Technologies',
  officialBrandName: 'Smartstream',
  adapter: 'script',
  homepageUrl: 'https://smart.stream/',
  companyCareerPage: 'https://smart.stream/careers/',
  atsPlatform: 'workable',
  countryFilter: 'India',
  paginationStrategy: 'declared-native-india-markdown-feed;bounded-full-role-pairs-with-closing-reconciliation',
  extractionStrategy: 'current-native-board-declared-markdown-discovery-country-query-full-criteria-and-own-apply-links;native-api-integer-identities',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'smart.stream',
  verifiedOn: '2026-11-19',
  scraperTimeoutMs: 300000,
  verifiedSurfaceSummary:
    'The current own Workable board declares llms.txt, its jobs.md feed, the public GET country query and each full Markdown role/application link. The own native account Smartstream Limited and official website bind the publisher. Full native API records preserve integer job identities, original dates, complete rich criteria and unknown fields; full Markdown/API criteria, workplace, type, department and same-role application links are checked. Two observations reconcile each complete original role, retaining changed, missing, foreign or unqualified rows as holds. No vacancy titles, IDs or criteria content are frozen. Reads are bounded to240seconds,15seconds/request,160requests,32hydrated roles,1MiB/entity and16MiB/aggregate. Valid partial criteria retain explicit partial status under current publication policy. Company inventory, current corporate handoff, rendered UI, application questions/backend activation and lifecycle cleanup remain unverified.',
  sourceScopeComplete: false,
  lifecycleCleanupAllowed: false,
  sourceActivationComplete: false,
  sourceRenderedCriteriaComplete: false,
  sourceApplicationQualificationComplete: false,
  modulePath: path.resolve(currentDir, 'nativeWorkable20261114.js'),
}

export default SMARTSTREAM_TECHNOLOGIES_CATALOG
