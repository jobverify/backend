import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TOMTOM_CATALOG = {
  source: 'tomtom',
  companyName: 'TomTom',
  officialBrandName: 'TomTom',
  adapter: 'script',
  companyCareerPage: 'https://www.tomtom.com/careers/',
  officialCareersPageUrl: 'https://www.tomtom.com/careers/',
  officialPuneOfficeUrl: 'https://www.tomtom.com/careers/offices/pune/',
  officialLeverBoardUrl: 'https://jobs.eu.lever.co/tomtom',
  leverApiUrl: 'https://api.eu.lever.co/v0/postings/tomtom?mode=json',
  companyDomain: 'tomtom.com',
  atsPlatform: 'lever',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-and-office-pages-plus-eu-lever-api',
  extractionStrategy:
    'verified-first-party-careers-page+verified-pune-office-page+verified-pune-jobs-overview+verified-eu-lever-board+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-06',
  verifiedSurfaceSummary:
    'Verified on Thursday, August 6, 2026 that https://www.tomtom.com/careers/ is the live TomTom careers landing page, that https://www.tomtom.com/careers/offices/pune/ is the live TomTom Pune office page for TomTom India Pvt Ltd, and that https://jobs.eu.lever.co/tomtom is the official TomTom Lever board. The live Lever postings API at https://api.eu.lever.co/v0/postings/tomtom?mode=json returned 26 jobs, including one Pune, India role titled Engineer III (SAP SD). This provider is pinned to the live first-party careers surfaces plus the public Lever board and API rather than the now-stale first-party TomTom job-detail route.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default TOMTOM_CATALOG
