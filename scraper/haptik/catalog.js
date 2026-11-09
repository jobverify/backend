import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HAPTIK_CATALOG = {
  source: 'haptik',
  companyName: 'Haptik',
  officialBrandName: 'Haptik',
  adapter: 'script',
  companyCareerPage: 'https://www.haptik.ai/careers',
  companyDomain: 'haptik.ai',
  atsPlatform: 'freshteam',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-page-plus-public-freshteam-board',
  extractionStrategy: 'verified-careers-handoff+public-freshteam-board+detail-page-apply-surface',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  officialCareersPageUrl: 'https://www.haptik.ai/careers',
  officialJobsBoardUrl: 'https://haptik.freshteam.com/jobs',
  detailUrlPattern: 'https://haptik.freshteam.com/jobs/{opaque_id}/{slug}',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on 2026-07-16 that the first-party Haptik careers page at https://www.haptik.ai/careers links to the public Freshteam board at https://haptik.freshteam.com/jobs and that the board currently exposes India roles including Software Engineer - Backend and Voice AI Engineer (Hybrid).',
  modulePath: path.join(currentDir, 'script.js'),
}

export default HAPTIK_CATALOG
