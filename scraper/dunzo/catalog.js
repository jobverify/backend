import {nativeGetMetadata} from '../../scraper-support/native-sources/publicNativeGetSources/nativeCareers.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const HISTORICAL_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://dunzo.com/ and https://www.dunzo.com/ resolve to 127.0.0.1, that the first-party paths https://dunzo.com/career, https://dunzo.com/careers, and https://dunzo.com/jobs remain unavailable on the loopback-only official hosts, and that the public Workable surfaces at https://apply.workable.com/dunzo/, https://apply.workable.com/dunzo/jobs.md, and https://apply.workable.com/api/v1/widget/accounts/dunzo were live with 0 current openings on the verified date.'

const LEGACY_DUNZO_CATALOG = {
  source: 'dunzo',
  companyName: 'Dunzo',
  officialBrandName: 'dunzo',
  adapter: 'script',
  homepageUrl: 'https://dunzo.com/',
  companyCareerPage: 'https://apply.workable.com/dunzo/',
  officialHostnames: [
    'dunzo.com',
    'www.dunzo.com',
  ],
  verifiedFirstPartyUrls: [
    'https://dunzo.com/',
    'https://www.dunzo.com/',
    'https://dunzo.com/career',
    'https://dunzo.com/careers',
    'https://dunzo.com/jobs',
  ],
  workableBoardUrl: 'https://apply.workable.com/dunzo/',
  jobsFeedUrl: 'https://apply.workable.com/dunzo/jobs.md',
  widgetApiUrl: 'https://apply.workable.com/api/v1/widget/accounts/dunzo',
  companyDomain: 'dunzo.com',
  atsPlatform: 'workable',
  countryFilter: 'India',
  paginationStrategy: 'workable-markdown-feed',
  extractionStrategy:
    'verified-loopback-first-party-domain+verified-workable-board+verified-workable-jobs-feed+verified-workable-widget-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: HISTORICAL_SURFACE_SUMMARY,
  dryRunFile: 'dunzo/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export const DUNZO_CATALOG = nativeGetMetadata('dunzo', LEGACY_DUNZO_CATALOG)
export const VERIFIED_SURFACE_SUMMARY = DUNZO_CATALOG.verifiedSurfaceSummary

export default DUNZO_CATALOG
