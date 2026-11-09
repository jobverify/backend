import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SIGMA_COMPUTING_CATALOG = {
  source: 'sigmacomputing',
  companyName: 'Sigma Computing',
  officialBrandName: 'Sigma',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'sigmacomputing/jobs.json',
  companyCareerPage: 'https://www.sigmacomputing.com/company/careers',
  greenhouseBoardUrl: 'https://job-boards.greenhouse.io/sigmacomputing',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/sigmacomputing/jobs',
  companyDomain: 'sigmacomputing.com',
  verifiedPublicJobCount: null,
  verifiedIndiaJobCount: null,
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'full-native-board-and-advertised-role-ids+full-public-details+current-native-offices+final-listing-after-all-criteria',
  extractionStrategy: 'original-native-envelope+full-public-criteria+exact-role-office-ID-address-and-membership-country-proof+original-publication-date',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: null,
  sourceScopeComplete: false,
  sourceListingComplete: false,
  lifecycleCleanupAllowed: false,
  verifiedSurfaceSummary: "The current official Sigma Computing careers page advertises the exact sigmacomputing Greenhouse board. Runtime preserves every original board/detail field and uses exact same-role office identity, publisher address and current directory membership only for otherwise unresolved matching primary worksite labels. Typed or conflicting countries, remote and unmatched alternatives remain intact. Full public criteria and closing office bindings precede the final native listing; unresolved configured-board country/criteria/advertised-role gaps retain unknown totals. Company-wide scope and cleanup remain separate and unverified.",
}

export default SIGMA_COMPUTING_CATALOG
