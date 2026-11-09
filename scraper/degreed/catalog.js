import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const PROVIDER_METADATA = {
  source: 'degreed', companyName: 'Degreed', companyDomain: 'degreed.com',
  adapter: 'script', catalogOverride: true,
  modulePath: path.join(currentDir, 'script.js'), dryRunFile: path.join(currentDir, 'jobs.json'),
  companyCareerPage: 'https://degreed.com/experience/careers/',
  jobsBoardUrl: 'https://job-boards.greenhouse.io/degreed', boardToken: 'degreed',
  atsPlatform: 'greenhouse-native-remix-and-public-api', countryFilter: 'India',
  parser: 'degreed-native-corporate-and-role-content', normalizationProfile: 'engineering-default',
  paginationStrategy: 'current-native-client-page-query;all-pages-count-and-identity-reconciled;opening-and-closing',
  extractionStrategy: 'advertised-corporate-careers-channels;native-board-and-public-api;all-full-role-details-before-output-cap',
  zeroResultPolicy: 'evidence-required', sourceScopeComplete: false, lifecycleCleanupAllowed: false,
  backfillMode: 'native-current-binding-and-role-extraction',
  sourceScopeNotes: 'Catalog metadata grants no completeness. Each run verifies current corporate handoff and every advertised corporate locale, all native pages/API records, native full criteria, role identity and primary/secondary geography, then closing inventories. Unknown countries, extra hiring channels, drift or failed details retain unknown counts and disable cleanup. Native first_published remains distinct from board/detail published_at and updated_at. No application requests or persistence.',
  verifiedPublicJobCount: null, verifiedIndiaJobCount: null, verifiedOn: null,
}
export default PROVIDER_METADATA
