import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PLUTO7_CATALOG = {
  source: 'pluto7',
  companyName: 'Pluto7',
  officialBrandName: 'Pluto7',
  adapter: 'script',
  homepageUrl: 'https://pluto7.com/',
  companyCareerPage: 'https://pluto7.com/career-openings/',
  companyDomain: 'pluto7.com',
  atsPlatform: 'freshteam',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-page-plus-career-openings-freshteam-widget',
  extractionStrategy:
    'verified-careers-page+freshteam-widget+public-freshteam-search+detail-page-apply-surface',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  officialCareersPageUrl: 'https://pluto7.com/careers/',
  freshteamWidgetScriptUrl:
    'https://s3.amazonaws.com/files.freshteam.com/production/30755/attachments/2000860557/original/2000015632_widget.js?1579600329',
  officialJobsBoardUrl: 'https://pluto7.freshteam.com/jobs',
  listingSearchUrl: 'https://pluto7.freshteam.com/jobs/search',
  detailUrlPattern: 'https://pluto7.freshteam.com/jobs/{opaque_id}/{slug}',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that the exact-name Pluto7 careers pages at https://pluto7.com/careers/ and https://pluto7.com/career-openings/ hand off to the public Freshteam board at https://pluto7.freshteam.com/jobs/search via the official widget script, and that the board currently exposes the India role Cloud DevOps and Security Engineer.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default PLUTO7_CATALOG
