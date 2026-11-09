import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Thursday, July 16, 2026 that the official Marico India careers page at https://marico.com/india/careers/work-with-us is live and links through APPLY NOW to the public SenseHQ board at https://marico.sensehq.com/careers, and that the verified public board currently exposes 7 open jobs. Verified sample role: Senior Officer - Production at https://marico.sensehq.com/careers/jobs/31806.'

export const MARICO_CATALOG = {
  source: 'marico',
  companyName: 'Marico',
  officialBrandName: 'Marico Limited',
  adapter: 'script',
  homepageUrl: 'https://marico.com/',
  companyCareerPage: 'https://marico.com/india/careers/work-with-us',
  publicBoardUrl: 'https://marico.sensehq.com/careers',
  sampleJobUrl: 'https://marico.sensehq.com/careers/jobs/31806',
  companyDomain: 'marico.com',
  atsPlatform: 'sensehq',
  countryFilter: 'India',
  paginationStrategy: 'verified-official-careers-page-plus-public-sensehq-board-pagination',
  extractionStrategy: 'verified-official-careers-page+public-sensehq-next-data-board+india-openings-only',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedPublicOpeningCount: 7,
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'marico/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default MARICO_CATALOG
