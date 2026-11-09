import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const GARDEN_REACH_SHIPBUILDERS_CATALOG = {
  source: 'gardenreachshipbuilders',
  companyName: 'Garden Reach Shipbuilders',
  officialBrandName: 'Garden Reach Shipbuilders & Engineers Limited',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'gardenreachshipbuilders/jobs.json',
  homepageUrl: 'https://www.grse.in/',
  companyCareerPage: 'https://www.grse.in/career/index',
  verifiedApplyPortalUrls: [
    'https://jobapply.in/grse2026/',
    'https://jobapply.in/grse2025/',
  ],
  companyDomain: 'grse.in',
  atsPlatform: 'official-company-careers-with-linked-public-apply-portal',
  countryFilter: 'India',
  dryRunEnrichPublicExperience: false,
  paginationStrategy: 'reachable-jobapply-portal-index-pages-with-active-notice-detail-fetch',
  extractionStrategy:
    'verified-grse-careers-contract+reachable-jobapply-portal-indexes+active-notice-detail-pdf-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-15',
  verifiedSurfaceSummary:
    'Verified on Saturday, August 15, 2026 that the official GRSE careers page is https://www.grse.in/career/index, that it currently exposes officer notification 2026/04(O) for Chief General Manager (E-8) (Finance) alongside older notices, and that the linked official public application portal indexes https://jobapply.in/grse2026/ and https://jobapply.in/grse2025/ are reachable. Direct programmatic requests from Node to https://www.grse.in/, https://grse.in/, and their /career/index routes currently fail with Connect Timeout Error, so the scraper is intentionally pinned to the reachable official GRSE jobapply portal contract. Verified from the reachable GRSE 2026 notice page and PDF https://jobapply.in/GRSE2026CGMFin/ADV-ENG2026OS4.pdf that notification 2026/04(O) opened on August 7, 2026 and closes on August 27, 2026, so one active public opening remained on August 15, 2026, while older visible notices including 2026/03(O), 2026/01(E), 2025/08(O), and 2025/09(E) were already closed.',
}

export default GARDEN_REACH_SHIPBUILDERS_CATALOG
