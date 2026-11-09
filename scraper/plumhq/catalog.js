import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PLUM_HQ_CATALOG = {
  source: 'plumhq',
  companyName: 'Plum HQ',
  officialBrandName: 'Plum',
  adapter: 'script',
  homepageUrl: 'https://www.plumhq.com/',
  companyCareerPage: 'https://www.plumhq.com/careers',
  companyDomain: 'plumhq.com',
  atsPlatform: 'kula',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-page-plus-embedded-kula-board',
  extractionStrategy: 'verified-careers-page+embedded-kula-board+india-office-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  officialCareersPageUrl: 'https://www.plumhq.com/careers',
  officialJobsBoardUrl: 'https://careers.kula.ai/plumhq?jobs=true',
  officialKulaCompanyUrl: 'https://careers.kula.ai/plumhq',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that the exact-name first-party Plum careers page at https://www.plumhq.com/careers embeds the public Kula board at https://careers.kula.ai/plumhq?jobs=true and that the board exposes India roles including Lead, Account-Based Marketing and Mobile Fullstack Developer - II (iOS).',
  modulePath: path.join(currentDir, 'script.js'),
}

export default PLUM_HQ_CATALOG
