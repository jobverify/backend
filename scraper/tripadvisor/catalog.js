import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const TRIPADVISOR_CATALOG = {
  source: 'tripadvisor',
  companyName: 'Tripadvisor',
  adapter: 'script',
  companyCareerPage: 'https://careers.tripadvisor.com/',
  companyDomain: 'tripadvisor.com',
  officialJobsSurfaceUrl: 'https://job-boards.greenhouse.io/tripadvisor',
  atsPlatform: 'greenhouse-board-api',
  countryFilter: 'India',
  paginationStrategy: 'single-greenhouse-board-feed',
  extractionStrategy: 'verified-first-party-careers-page+official-greenhouse-board-api+india-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: null,
  verifiedAt: null,
  verifiedPublicJobCount: null,
  verifiedIndiaJobCount: null,
  zeroResultPolicy: 'evidence-required',
  sourceScopeComplete: false,
  sourceCompanyWideScopeComplete: false,
  lifecycleCleanupAllowed: false,
  configuredBoardProofRequiresLiveEvidence: true,
  verifiedSurfaceSummary:
    'Runtime binds the current corporate Open Positions route and its executable public inventory program to the complete declared Tripadvisor Greenhouse feed, departments and offices. Every original native vacancy and full public description is checked before India selection; own labelled workplaces and native assigned-office country proofs retain ambiguous country alternatives. A final native inventory traversal follows closing details. The separate native prospect is retained outside vacancy totals. Configured-board totals require fresh live proof; whole-company totals and lifecycle cleanup remain unknown.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default TRIPADVISOR_CATALOG
