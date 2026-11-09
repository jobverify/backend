import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const APTARA_CATALOG = {
  source: 'aptara',
  companyName: 'Aptara',
  officialBrandName: 'Aptara Corp',
  adapter: 'script',
  companyCareerPage: 'https://www.aptaracorp.com/careers/',
  homepageUrl: 'https://www.aptaracorp.com/',
  applyAnchorUrl: 'https://www.aptaracorp.com/careers/#applynow',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy:
    'verified-first-party-careers-page+inline-role-cards+shared-first-party-apply-anchor+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'aptaracorp.com',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://www.aptaracorp.com/ is the live first-party Aptara homepage and that its CAREERS navigation points to https://www.aptaracorp.com/careers/. The careers page exposes inline public role cards with a shared first-party #applynow resume form handoff at https://www.aptaracorp.com/careers/#applynow, including India listings for Instructional Designer Manager (IDM), Lead Instructional Designer (Lead ID), Associate Instructional Designer Manager (AIDM), Senior Instructional Designer Manager (Sr. IDM), Senior Instructional Designer (Sr. ID) in Pune, Maharashtra, and Sr. Financial Analyst/Financial Analyst in Perungudi, Chennai.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default APTARA_CATALOG
