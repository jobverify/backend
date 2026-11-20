import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const NICE_ACTIMIZE_CATALOG = {
  source: 'niceactimize',
  companyName: 'NICE Actimize',
  officialBrandName: 'NICE Actimize',
  adapter: 'script',
  officialActimizePageUrl: 'https://www.niceactimize.com/get-in-touch',
  companyCareerPage: 'https://www.nice.com/careers/apply?location=India+-+Pune',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/nice/jobs?content=true',
  greenhouseBoardHost: 'boards.eu.greenhouse.io',
  atsPlatform: 'greenhouse-board-api',
  countryFilter: 'India',
  paginationStrategy: 'single-greenhouse-board-feed',
  extractionStrategy:
    'verified-nice-actimize-first-party-handoff+verified-nice-careers-filter-page+greenhouse-board-api+actimize-india-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'nice.com',
  verifiedOn: '2026-08-13',
  verifiedJobCount: 7,
  sampleJobUrl: 'https://boards.eu.greenhouse.io/nice/jobs/4913142101?gh_jid=4913142101',
  verifiedSurfaceSummary:
    'Verified on Thursday, August 13, 2026 that https://www.niceactimize.com/get-in-touch remains the live first-party NICE Actimize handoff page and that it routes candidates to NICE careers. The filtered NICE careers surface at https://www.nice.com/careers/apply?location=India+-+Pune renders the generic "Careers at NiCE" heading with India - Pune selected while still exposing Actimize links such as Tech Manager, Actimize and Specialist Product Owner, Actimize ( BFSI, AI), and the public Greenhouse board feed at https://boards-api.greenhouse.io/v1/boards/nice/jobs?content=true yielded 7 India/Pune Actimize roles on the verified date.',
  dryRunFile: 'niceactimize/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default NICE_ACTIMIZE_CATALOG
