import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const RX_LOGIX_CORPORATION_CATALOG = {
  source: 'rxlogixcorporation',
  companyName: 'RxLogix Corporation',
  adapter: 'script',
  companyCareerPage: 'https://rxlogix.com/careers/',
  companyDomain: 'rxlogix.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-careers-page-plus-first-party-detail-pages',
  extractionStrategy: 'verified-first-party-careers-page+india-opening-links+first-party-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary:
    'Verified on Tuesday, August 4, 2026 that https://rxlogix.com/careers/ remains the official RxLogix careers page, now exposes India openings as first-party job_tab cards with root-level detail URLs such as https://rxlogix.com/technical-architect/ and https://rxlogix.com/performance-test-engineer/, and continues to list current India roles including Technical Architect, Performance Test Engineer, Data Engineer, and Business Development Manager.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default RX_LOGIX_CORPORATION_CATALOG
