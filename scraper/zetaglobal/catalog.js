import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ZETA_GLOBAL_CATALOG = {
  source: 'zetaglobal',
  companyName: 'Zeta Global',
  adapter: 'script',
  companyCareerPage: 'https://zetaglobal.com/about/benefits-and-hiring/',
  companyDomain: 'zetaglobal.com',
  atsPlatform: 'greenhouse-board-api',
  countryFilter: 'India',
  paginationStrategy: 'single-greenhouse-board-feed',
  extractionStrategy: 'verified-first-party-careers-page+official-greenhouse-board-api+india-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://zetaglobal.com/about/benefits-and-hiring/ remained the first-party Zeta Global careers page, presented a View Open Jobs handoff, and that Zeta Global exposed a public Greenhouse board at https://job-boards.greenhouse.io/zetaglobal/jobs with India-trackable roles via the official board feed.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default ZETA_GLOBAL_CATALOG
