import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, July 17, 2026 that the exact-name official careers page at https://www.revolut.com/en-IN/careers/ renders the live Revolut India careers surface and advertises 610 public roles. Verified by live browser inspection that the page exposes its public listings in window.__NEXT_DATA__.props.pageProps.positions, including 47 India roles. Verified a live India sample detail URL at https://www.revolut.com/en-US/careers/position/666ce819-a63a-4642-98c8-66c88af9c63a/, so this provider extracts the embedded first-party positions payload and filters it conservatively to India roles only.'

export const REVOLUT_CATALOG = {
  source: 'revolut',
  companyName: 'Revolut',
  officialBrandName: 'Revolut',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'revolut/jobs.json',
  officialHomepageUrl: 'https://www.revolut.com/',
  companyCareerPage: 'https://www.revolut.com/en-IN/careers/',
  officialCareersGlobalUrl: 'https://www.revolut.com/en-US/careers/',
  companyDomain: 'revolut.com',
  positionsDataSource: 'window.__NEXT_DATA__.props.pageProps.positions',
  verifiedPublicRoleCount: 610,
  verifiedIndiaRoleCount: 47,
  verifiedSampleIndiaJobUrl:
    'https://www.revolut.com/en-US/careers/position/666ce819-a63a-4642-98c8-66c88af9c63a/',
  atsPlatform: 'official-first-party-nextjs-careers',
  countryFilter: 'India',
  paginationStrategy: 'browser-loaded-nextjs-payload-single-page',
  extractionStrategy:
    'verified-en-IN-careers-page+verified-nextjs-positions-payload+india-country-filter+verified-detail-url-pattern',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default REVOLUT_CATALOG
