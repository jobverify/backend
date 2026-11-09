import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const LINEAR_CATALOG = {
  source: 'linear',
  companyName: 'Linear',
  officialBrandName: 'Linear',
  adapter: 'script',
  companyCareerPage: 'https://linear.app/careers',
  companyDomain: 'linear.app',
  atsPlatform: 'ashby-via-bound-first-party-careers-data',
  countryFilter: 'India',
  paginationStrategy: 'bound-first-party-role-groups-and-reconciled-native-posting-response',
  extractionStrategy:
    'active-bound-careers-model+native-role-identity+typed-geography+validated-native-india-details',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  dryRunFile: 'linear/jobs.json',
  verifiedOn: null,
  sourceScopeComplete: false,
  sourceCompanyWideScopeComplete: false,
  lifecycleCleanupAllowed: false,
  zeroResultPolicy: 'evidence-required',
  verifiedSurfaceSummary:
    'The current careers component binds grouped native Ashby role identities and public application URLs. Runtime can qualify the configured board when every advertised identity, native worksite, full public criterion and closing payload reconciles. Unknown or conflicting countries, unreviewed public fields, missing criteria and changed closing records retain partial evidence. Company totals and lifecycle cleanup remain unknown independently of configured-board completion.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default LINEAR_CATALOG
