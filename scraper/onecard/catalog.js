import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ONECARD_CATALOG = {
  source: 'onecard',
  companyName: 'OneCard',
  officialBrandName: 'OneCard',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  companyCareerPage: 'https://www.getonecard.app/careers/',
  officialCareersHandoffUrl: 'https://www.fplabs.tech/careers/',
  officialJobsApiUrl: 'https://ibffpublic6f2461135ffd1b6a80db296ec15abf.onrender.com/hr/jobs',
  officialJobsApiKey: 'hr-read-only',
  officialApplyUrl: 'mailto:careers@getonecard.app',
  companyDomain: 'getonecard.app',
  atsPlatform: 'official-careers-page-plus-gated-handoff-plus-broken-public-api',
  countryFilter: 'India',
  paginationStrategy: 'verified-gated-handoff-plus-broken-public-jobs-api',
  extractionStrategy: 'verified-official-careers-page+verified-fpl-handoff-js-gate+verified-broken-public-jobs-api-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-14',
  verifiedSurfaceSummary:
    'Verified on Friday, August 14, 2026 that https://www.getonecard.app/careers/ still exposed the official OneCard careers page, the handoff to https://www.fplabs.tech/careers/, the embedded public jobs API at https://ibffpublic6f2461135ffd1b6a80db296ec15abf.onrender.com/hr/jobs with x-api-key hr-read-only, and the apply mailto careers@getonecard.app. The FPL handoff route returned HTTP 307 with the "You are being redirected..." JavaScript-required gate, and the embedded public jobs API returned HTTP 500 with an invalid-json error referencing https://paa.fplabs.tech/proxy/CRUD/api/test-jobs?populate=*. There is no trustworthy public OneCard jobs listing surface in this environment on the verified date.',
  dryRunFile: 'onecard/jobs.json',
}

export default ONECARD_CATALOG
