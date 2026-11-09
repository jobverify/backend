import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Thursday, July 16, 2026 that Mazagon Dock Shipbuilders Limited publishes first-party recruitment tables at https://mazagondock.in/English/career/Career-Executives, https://mazagondock.in/English/career/Career-Non-Executives, and https://mazagondock.in/English/career/Career-Apprentice, with the careers overview at https://mazagondock.in/career/online-recruitment and the official application handoff at https://mazagondock.in/app/MDLJobPortal/Welcome.aspx. Live verification found the executive page listing only past or notice-only entries, the non-executive page listing no active rows, and the apprentice page listing the Trade Apprentices Batch 2026 corrigendum with last date 15-07-2026. Using Thursday, July 16, 2026 as the reference date, there are no active public recruitment postings remaining, but the official first-party jobs surface exists and should be scraped conservatively from those tables.'

export const MAZAGON_DOCK_SHIPBUILDERS_CATALOG = {
  source: 'mazagondockshipbuilders',
  companyName: 'Mazagon Dock Shipbuilders',
  officialBrandName: 'Mazagon Dock Shipbuilders Limited',
  adapter: 'script',
  homepageUrl: 'https://mazagondock.in/',
  companyCareerPage: 'https://mazagondock.in/career/online-recruitment',
  executiveCareerPageUrl: 'https://mazagondock.in/English/career/Career-Executives',
  nonExecutiveCareerPageUrl: 'https://mazagondock.in/English/career/Career-Non-Executives',
  apprenticeCareerPageUrl: 'https://mazagondock.in/English/career/Career-Apprentice',
  onlineRecruitmentPortalUrl: 'https://mazagondock.in/app/MDLJobPortal/Welcome.aspx',
  companyDomain: 'mazagondock.in',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-multi-page-html-table-scan-plus-closing-date-filter',
  extractionStrategy: 'verified-executive-nonexecutive-apprentice-pages+official-online-recruitment-handoff+active-opening-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'mazagondockshipbuilders/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default MAZAGON_DOCK_SHIPBUILDERS_CATALOG
