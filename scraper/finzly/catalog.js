import path from 'node:path'
import { fileURLToPath } from 'node:url'
const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const FINZLY_CATALOG = {
  source: 'finzly', companyName: 'Finzly', officialBrandName: 'Finzly', adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'), dryRunFile: 'finzly/jobs.json',
  homepageUrl: 'https://finzly.com/', companyCareerPage: 'https://finzly.com/careers/', companyDomain: 'finzly.com',
  atsPlatform: 'first-party-wordpress-careers', countryFilter: 'India',
  paginationStrategy: 'current-local-filter-client+all-advertised-details+closing-card-reconciliation',
  extractionStrategy: 'current-first-party-card-set+published-native-page-identities+full-visible-role-content',
  backfillMode: 'live-parser', zeroResultPolicy: 'evidence-required', parser: 'custom-script', normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-26',
  verifiedSurfaceSummary: 'Current Finzly corporate careers page publishes its own role cards and detail URLs. Runtime verifies the local filtering client, full visible role-owned content, native page identity/status, assigned India offices and role-specific application email, then closing cards and fully paginated published-page states. Assigned Charlotte, NC is matched to the current official US office. WordPress document dates are not job posting dates. Advertised roles and additional published pages remain distinct inventories; unknown lifecycle/totals and differing location sets retain partial evidence and disable cleanup.',
}
export default FINZLY_CATALOG
