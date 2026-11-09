import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AISLE_CATALOG = {
  source: 'aisle',
  companyName: 'Aisle',
  adapter: 'script',
  companyCareerPage: 'https://www.aisle.co/',
  companyDomain: 'aisle.co',
  atsPlatform: 'freshteam',
  countryFilter: 'India',
  paginationStrategy: 'official-homepage-plus-public-freshteam-board-or-verified-500-outage',
  extractionStrategy: 'verified-homepage-handoff+public-freshteam-board-or-verified-500-outage-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  officialHomepageUrl: 'https://www.aisle.co/',
  officialJobsBoardUrl: 'https://aisle.freshteam.com/jobs',
  detailUrlPattern: 'https://aisle.freshteam.com/jobs/{opaque_id}/{slug}',
  verifiedOn: '2026-07-28',
  verifiedSurfaceSummary:
    'Verified on July 28, 2026 that https://www.aisle.co/ is still the live first-party Aisle homepage, the homepage careers CTA still says "Check Openings" and links directly to https://aisle.freshteam.com/jobs, and that the exact public Freshteam board now returns the generic Freshteam 500 error page instead of a trustworthy openings inventory or stable empty-state listing. This provider therefore stays fail-closed and returns an empty set until the exact public board recovers.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default AISLE_CATALOG
