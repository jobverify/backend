import path from 'node:path'
import { fileURLToPath } from 'node:url'
const dir = path.dirname(fileURLToPath(import.meta.url))
export default {
  source: 'rakuten', companyName: 'Rakuten', officialBrandName: 'Rakuten India', legalEmployerName: null,
  adapter: 'script', modulePath: path.join(dir, 'script.js'), companyDomain: 'corp.rakuten.co.in',
  companyCareerPage: 'https://corp.rakuten.co.in/', countryFilter: 'India', atsPlatform: 'zwayam',
  sourceTimeoutMs: 180000, scraperTimeoutMs: 190000,
  paginationStrategy: 'current-native-careersite-account-selected-query-and-complete-paired-public-search',
  extractionStrategy: 'current-own-literal-portal-handoff+registered-public-client+status1-native-search+same-role-public-details+earliest-native-creation+paired-India-publication-partials',
  dryRunFile: 'rakuten/jobs.json', sourceScopeComplete: false, companyInventoryComplete: false,
  lifecycleCleanupAllowed: false,
  verifiedSurfaceSummary: 'Current corporate root links literally to Rakuten native careers. Current own-declared client and public company configuration bind15124/rakuten.openings.co. Native query selects status1/date-range/public visibility; same-role public detail resolves with selected active status. Every raw date and unscoped other-status label is retained. Legal employer, formal requisition, all-company totals, UI rendering, application backend and cleanup remain held.',
}
