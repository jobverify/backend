import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 16, 2026 that the official first-party IDfy careers route ' +
  'https://www.idfy.com/careers/ redirects to the published TurboHire board ' +
  'https://idfy.turbohire.co/careerpage/e73676a8-bc5a-4b43-b9c6-d3fc7a60b572. ' +
  'The public TurboHire no-auth token flow and filtered jobs API returned 14 public jobs on the verified date, ' +
  'including "Module Lead - DevOps" in Mumbai, Maharashtra, India.'

export const IDFY_CATALOG = {
  source: 'idfy',
  companyName: 'IDfy',
  officialBrandName: 'IDfy',
  adapter: 'script',
  companyCareerPage: 'https://www.idfy.com/careers/',
  handoffBoardUrl: 'https://idfy.turbohire.co/careerpage/e73676a8-bc5a-4b43-b9c6-d3fc7a60b572',
  turboHireOrgId: 'e73676a8-bc5a-4b43-b9c6-d3fc7a60b572',
  companyDomain: 'idfy.com',
  atsPlatform: 'turbohire',
  countryFilter: 'India',
  verifiedLiveJobCount: 14,
  verifiedIndiaSampleTitle: 'Module Lead - DevOps',
  paginationStrategy: 'official-careers-page-handoff-plus-public-turbohire-api',
  extractionStrategy:
    'official-careers-page-redirect+turbohire-board+noauth-token+filteredjobs-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'idfy/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default IDFY_CATALOG
