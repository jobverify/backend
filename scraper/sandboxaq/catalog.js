import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SANDBOXAQ_CATALOG = {
  source: 'sandboxaq',
  companyName: 'SandboxAQ',
  officialBrandName: 'SandboxAQ',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  homepageUrl: 'https://www.sandboxaq.com/',
  companyCareerPage: 'https://www.sandboxaq.com/careers',
  officialCareersListUrl: 'https://www.sandboxaq.com/careers-list',
  ashbyPublicBoardUrl: 'https://jobs.ashbyhq.com/sandboxaq',
  ashbyJobBoardUrl: 'https://api.ashbyhq.com/posting-api/job-board/sandboxaq',
  atsPlatform: 'first-party-declared-ashby-current-public-native-board-model',
  countryFilter: 'Global',
  paginationStrategy: 'paired-current-own-declared-native-appData-jobBoard-array-configured-surface-only',
  extractionStrategy:
    'current-own-careers-handoffs+connected-declared-native-embed-account+whole-primary-and-secondary-native-country-models',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  authoritativeCurrentPublication: true,
  backfillMode: 'live-parser',
  scraperTimeoutMs: 180000,
  companyDomain: 'sandboxaq.com',
  verifiedOn: null,
  verifiedJobCount: null,
  verifiedIndiaJobCount: null,
  verifiedSurfaceSummary:
    'Pairs current own corporate careers handoffs, their connected declared native embed account, and the original public native board JobBoard model. Fetched-zero is restricted to this configured surface when every nonempty current primary and secondary whole native workplace country is explicitly foreign in both observations. India, unknown, malformed, maintenance, empty or denied models remain held. Original models retained; no India-facet, whole-company/all-channel total, application activation or cleanup claim.',
  dryRunFile: 'sandboxaq/jobs.json',
}

export default SANDBOXAQ_CATALOG
