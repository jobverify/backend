import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Thursday, July 16, 2026 that https://careers.loadshare.net/ redirects to the live official Loadshare Networks careers page at https://careers.loadshare.net/loadshare/, and that the public SenseHQ board at https://loadshare.sensehq.com/careers exposes 4 public openings. Verified sample role: Business Finance Manager at https://loadshare.sensehq.com/careers/jobs/54441. The provider therefore verifies the official careers page and extracts open India jobs from the public SenseHQ board.'

export const LOADSHARE_NETWORKS_CATALOG = {
  source: 'loadsharenetworks',
  companyName: 'Loadshare Networks',
  officialBrandName: 'LoadShare Networks Pvt. Ltd.',
  adapter: 'script',
  homepageUrl: 'https://loadshare.net/',
  rootCareersUrl: 'https://careers.loadshare.net/',
  companyCareerPage: 'https://careers.loadshare.net/loadshare/',
  publicBoardUrl: 'https://loadshare.sensehq.com/careers',
  sampleJobUrl: 'https://loadshare.sensehq.com/careers/jobs/54441',
  companyDomain: 'loadshare.net',
  atsPlatform: 'sensehq',
  countryFilter: 'India',
  paginationStrategy: 'verified-official-careers-page-plus-public-sensehq-board-pagination',
  extractionStrategy: 'verified-official-careers-page+public-sensehq-next-data-board+india-openings-only',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'loadsharenetworks/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default LOADSHARE_NETWORKS_CATALOG
