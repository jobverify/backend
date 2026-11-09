import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PIXXEL_CATALOG = {
  source: 'pixxel',
  companyName: 'Pixxel',
  adapter: 'script',
  companyCareerPage: 'https://www.pixxel.space/careers',
  companyDomain: 'pixxel.space',
  atsPlatform: 'darwinbox',
  countryFilter: 'India',
  paginationStrategy: 'browser-session-darwinbox-pagination',
  extractionStrategy: 'official-careers-page+darwinbox-listing-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  officialCareersHandoffUrl: 'https://pixxel.darwinbox.in/ms/candidate/careers',
  darwinboxOrigin: 'https://pixxel.darwinbox.in',
  darwinboxCompanyId: 'main',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.pixxel.space/careers is the live official Pixxel careers page and that its visible View current openings / Explore opportunities calls-to-action hand candidates to https://pixxel.darwinbox.in/ms/candidate/careers. Current public Pixxel candidate pages discoverable from that Darwinbox tenant include India role surfaces such as Calibration Engineer and Role Explorer in Bengaluru, which makes the official careers page plus Darwinbox handoff a trustworthy exact-name scraper surface.',
  dryRunFile: 'pixxel/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default PIXXEL_CATALOG
