import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const COMPUTER_GENERATED_SOLUTIONS_CATALOG = {
  source: 'computergeneratedsolutions',
  companyName: 'Computer Generated Solutions',
  officialBrandName: 'CGS (Computer Generated Solutions Inc.)',
  adapter: 'script',
  companyCareerPage: 'https://cgsinc.com/en/cgs-careers',
  jobsBoardUrl: 'https://job-boards.greenhouse.io/computergeneratedsolutions',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/computergeneratedsolutions/jobs?content=true',
  atsPlatform: 'greenhouse-board-api',
  countryFilter: 'India',
  paginationStrategy: 'single-greenhouse-board-feed',
  extractionStrategy: 'verified-first-party-careers-page+official-greenhouse-board-api+india-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'cgsinc.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://cgsinc.com/en/cgs-careers was the live first-party CGS careers page, that it handed candidates to the official Greenhouse board https://job-boards.greenhouse.io/computergeneratedsolutions titled "Current openings at CGS Inc (USA)", and that the public Greenhouse feed at https://boards-api.greenhouse.io/v1/boards/computergeneratedsolutions/jobs?content=true currently exposed only three US roles: Founding Sales Leader, On-Site Junior Server Support - Call Center, and Technical Customer Service - On-site. The local scraper therefore keeps the verified India filter and currently returns an empty set.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'computergeneratedsolutions/jobs.json',
}

export default COMPUTER_GENERATED_SOLUTIONS_CATALOG
