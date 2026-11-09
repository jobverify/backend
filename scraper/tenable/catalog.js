import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TENABLE_CATALOG = {
  source: 'tenable',
  companyName: 'Tenable',
  adapter: 'script',
  companyCareerPage: 'https://www.tenable.com/careers',
  companyDomain: 'tenable.com',
  atsPlatform: 'greenhouse-board-api',
  countryFilter: 'India',
  paginationStrategy: 'single-greenhouse-board-feed',
  extractionStrategy:
    'verified-first-party-careers-handoff+official-greenhouse-board-api+india-location-and-country-metadata-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  greenhouseBoardId: 'tenableinc',
  greenhouseBoardUrl: 'https://job-boards.greenhouse.io/tenableinc',
  greenhouseJobsApiUrl:
    'https://boards-api.greenhouse.io/v1/boards/tenableinc/jobs?content=true',
  firstPartyJobSearchUrl: 'https://www.tenable.com/careers/search',
  firstPartyJobsApiUrl: 'https://www.tenable.com/evaluations/api/v1/jobs',
  verifiedOn: '2026-07-23',
  verifiedSurfaceSummary:
    'Verified on Thursday, July 23, 2026 that Tenable\'s official careers page links to its first-party job search and the tenableinc Greenhouse board. The first-party jobs API and official Greenhouse board API each returned 56 live openings and zero India openings. The formerly indexed Commercial Territory Manager India/remote opening was absent from both live feeds, and its historical Greenhouse job URL redirected to the board error state.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default TENABLE_CATALOG
