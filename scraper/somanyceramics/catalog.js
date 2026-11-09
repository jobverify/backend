import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Monday, July 27, 2026 that https://www.somanyceramics.com/work-with-us is the live official Somany Ceramics careers page titled "Careers - Somany Ceramics", that it still leads with the first-party hiring copy "Opportunities that grow with you.", and that it exposes inline public job cards under Work With Us. The verified first-party page publishes Goodfit Know More handoffs on https://v2.app.goodfit.so/ for live roles including Area Sales Manager in Agra, Senior Territory Manager - CPD Sales in Delhi, Area Sales Manager in Bathinda, and DM- Business Development, so this provider extracts the inline first-party job cards and trusts their official Goodfit apply links.'

export const SOMANY_CERAMICS_CATALOG = {
  source: 'somanyceramics',
  companyName: 'Somany Ceramics',
  officialBrandName: 'Somany Ceramics Limited',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'somanyceramics/jobs.json',
  companyCareerPage: 'https://www.somanyceramics.com/work-with-us',
  jobsBoardUrl: 'https://www.somanyceramics.com/work-with-us',
  officialHandoffHost: 'https://v2.app.goodfit.so',
  verifiedSampleApplyUrl:
    'https://v2.app.goodfit.so/jobs/somany-ceramics-tiles/Area-Sales-Manager-Agra?id=8e35b993-a160-4816-bb19-2414c5a518b4',
  companyDomain: 'somanyceramics.com',
  atsPlatform: 'first-party-careers-page-with-goodfit-handoff',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-inline-job-cards',
  extractionStrategy: 'verified-first-party-careers-page+inline-job-cards+goodfit-apply-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-27',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default SOMANY_CERAMICS_CATALOG
