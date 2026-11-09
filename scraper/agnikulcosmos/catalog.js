import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AGNIKUL_COSMOS_CATALOG = {
  source: 'agnikulcosmos',
  companyName: 'Agnikul Cosmos',
  officialBrandName: 'Agnikul Cosmos',
  adapter: 'script',
  companyCareerPage: 'https://www.agnikul.in/careers/',
  homepageUrl: 'https://www.agnikul.in/',
  applicationEmail: 'humancapital@agnikul.in',
  applicationUrl: 'mailto:humancapital@agnikul.in',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy: 'verified-first-party-careers-page+inline-role-cards+shared-email-apply-handoff',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'agnikul.in',
  verifiedOn: '2026-07-14',
  verifiedSurfaceSummary:
    'Verified on July 14, 2026 that https://www.agnikul.in/careers/ is the live first-party Agnikul Cosmos careers page, https://www.agnikul.in/career redirects to it, and the page publishes four inline public role cards: Power electronics Engineer, Mission Design Software Developer, Launch Vehicle Operations Strategist, and ERPNext Developer. Each card lists Chennai, India and Full Time metadata and uses the shared apply handoff mailto:humancapital@agnikul.in.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default AGNIKUL_COSMOS_CATALOG
