import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ANR_SOFTWARE_PRIVATE_LIMITED_CATALOG = {
  source: 'anrsoftwareprivatelimited',
  companyName: 'ANR Software Private Limited',
  officialBrandName: 'ANR Software Pvt. Ltd.',
  adapter: 'script',
  homepageUrl: 'https://www.anrsoftware.com/',
  companyCareerPage: 'https://www.anrsoftware.com/career/',
  atsPlatform: 'first-party-public-role-criteria-country-and-id-gap',
  countryFilter: 'India',
  paginationStrategy: 'all-declared-card-observations-public-reveal-and-closing-comparison',
  extractionStrategy: 'current-native-CSS-and-accordion+full-public-card-criteria+unknown-country-and-identity+bounded-audit',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'anrsoftware.com',
  sourceScopeComplete: false,
  sourceListingComplete: false,
  lifecycleCleanupAllowed: false,
  authoritativeSourceTotal: null,
  authoritativeIndiaFacetCount: null,
  zeroResultPolicy: 'evidence-required',
  verifiedOn: '2026-07-18',
  verificationIsHistorical: true,
  verifiedSurfaceSummary:
    'Historical July 18 metadata, not current qualification: Verified on Saturday, July 18, 2026 that https://www.anrsoftware.com/career/ is the live first-party ANR Software careers page and exposes role cards, but the same public rows simultaneously advertise opening counts and the explicit empty-state message "No vacancy for this position now. Visit again!" across the page. Because the public first-party contract is contradictory and not trustworthy enough to enumerate open roles honestly, this provider fails closed and returns an empty list.',
  currentSurfaceSummary: 'Runtime validates current public CSS, jQuery/controller assets and native accordion/form-context handlers, retains every raw card and complete proved public criterion, and reconciles closing models. Enabled native role controls and hidden/disabled branches are distinguished. Duplicate control/title IDs remain unsuitable as posting IDs; explicit role countries are absent. All native source/India totals and lifecycle cleanup remain unknown. Current counts belong only to immutable runtime reports.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default ANR_SOFTWARE_PRIVATE_LIMITED_CATALOG
