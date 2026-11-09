import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TRANSFORM_HUB_CATALOG = {
  source: 'transformhub',
  companyName: 'TransformHub',
  officialBrandName: 'TransformHub',
  adapter: 'script',
  homepageUrl: 'https://www.transformhub.com/',
  companyCareerPage: 'https://www.transformhub.com/career',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-text-sections',
  extractionStrategy:
    'verified-first-party-careers-page+inline-job-sections+shared-careers-page-apply',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'transformhub.com',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.transformhub.com/career was the live first-party TransformHub careers page, that it exposed a Current Openings section directly on that page, and that it publicly listed inline roles including DEVSECOPS - SENIOR ENGINEER (Vietnam & Pan India), DATA ANALYST (Vietnam), and ZOHO DEVELOPER (Navi Mumbai).',
  modulePath: path.join(currentDir, 'script.js'),
}

export default TRANSFORM_HUB_CATALOG
