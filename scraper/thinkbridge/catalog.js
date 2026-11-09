import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const THINKBRIDGE_CATALOG = {
  source: 'thinkbridge',
  companyName: 'thinkbridge',
  officialBrandName: 'thinkbridge',
  adapter: 'script',
  companyCareerPage: 'https://www.thinkbridge.com/careers',
  companyDomain: 'thinkbridge.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'Global',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy: 'verified-first-party-careers-page+role-detail-pages+official-application-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-03',
  verifiedPublicJobCount: 3,
  verifiedSurfaceSummary:
    'Verified on October 3, 2026 that https://www.thinkbridge.com/careers lists three live roles: Customer Success Lead and Delivery Principal as remote anywhere, and Senior Full-Stack Engineer in Surat, India. Each same-domain role page exposes a matching title, description, and application link to careers.thinkbridge.com.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default THINKBRIDGE_CATALOG
