import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const GREAVES_ELECTRIC_MOBILITY_CATALOG = {
  source: 'greaveselectricmobility',
  companyName: 'Greaves Electric Mobility',
  officialBrandName: 'Greaves Electric Mobility Limited',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'greaveselectricmobility/jobs.json',
  officialHomepageUrl: 'https://greaveselectricmobility.com/',
  companyCareerPage: 'https://greaveselectricmobility.com/careers',
  officialCareersHandoffUrl: 'https://peopleatgems.kekahire.com/',
  companyDomain: 'greaveselectricmobility.com',
  atsPlatform: 'keka-handoff-unverifiable',
  countryFilter: 'India',
  paginationStrategy: 'first-party-careers-page-plus-external-keka-handoff-no-verifiable-public-board',
  extractionStrategy:
    'verified-first-party-careers-page+verified-keka-handoff+transport-unverifiable-fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://greaveselectricmobility.com/careers is the live first-party careers page for Greaves Electric Mobility Limited, that the same page still presents the Open Positions / View Jobs handoff to https://peopleatgems.kekahire.com/, and that the page carries Greaves Electric Mobility identity markers including customersupport@greaveselectricmobility.com and the footer label Greaves Electric Mobility Limited. Direct verification attempts against https://peopleatgems.kekahire.com/ from this workspace failed on the verified date with Connect Timeout Error probes and PowerShell trust relationship / SSL-TLS verification failures, so no trustworthy public jobs board could be verified. This provider therefore fails closed and returns an empty array until the linked public jobs surface becomes verifiable again.',
}

export default GREAVES_ELECTRIC_MOBILITY_CATALOG
