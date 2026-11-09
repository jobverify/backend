import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCEDESKGLOBAL_CATALOG = {
  source: 'sourcedeskglobal',
  companyName: 'Sourcedesk Global',
  officialBrandName: 'Sourcedesk',
  adapter: 'script',
  homepageUrl: 'https://www.sourcedesk.io/',
  companyCareerPage: 'https://www.sourcedesk.io/current-openings',
  sampleJobUrl: 'https://www.sourcedesk.io/current-openings/seo-executive',
  atsPlatform: 'first-party-nextjs-current-openings-pages',
  countryFilter: 'India',
  paginationStrategy: 'single-current-openings-page-plus-first-party-detail-pages',
  extractionStrategy: 'verified-current-openings-page+first-party-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'sourcedesk.io',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary:
    'Verified on Tuesday, August 4, 2026 that the legacy archive at https://www.sourcedeskglobal.com/job/ now redirects to the live first-party Sourcedesk current-openings page at https://www.sourcedesk.io/current-openings, that the old sample WordPress detail URL now returns 404, and that the current first-party detail pages such as https://www.sourcedesk.io/current-openings/seo-executive and https://www.sourcedesk.io/current-openings/urgent-position-business-associate-online-bidder are publicly reachable and enumerate live India openings on sourcedesk.io.',
  dryRunFile: 'sourcedeskglobal/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SOURCEDESKGLOBAL_CATALOG
