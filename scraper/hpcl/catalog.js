import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 16, 2026 that https://www.hindustanpetroleum.com/careers is the live first-party HPCL careers page, that it links to the official openings page at https://www.hindustanpetroleum.com/job-openings and the candidate portal at https://jobs.hpcl.co.in/Recruit_New/recruitlogin.jsp, and that the current openings section exposes six current opening cards on the first-party surface. Verified that one stale result-oriented Recruitment of Officers 2026 card remains mixed into the page and should be excluded, leaving the active official openings plus the PESB director application handoff.'

export const HPCL_CATALOG = {
  source: 'hpcl',
  companyName: 'HPCL',
  officialBrandName: 'Hindustan Petroleum Corporation Limited',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'hpcl/jobs.json',
  homepageUrl: 'https://www.hindustanpetroleum.com/',
  companyCareerPage: 'https://www.hindustanpetroleum.com/careers',
  officialJobOpeningsUrl: 'https://www.hindustanpetroleum.com/job-openings',
  verifiedApplyPortalUrls: [
    'https://jobs.hpcl.co.in/Recruit_New/recruitlogin.jsp',
    'https://pesb.gov.in/UserAccount/Login',
  ],
  companyDomain: 'hindustanpetroleum.com',
  atsPlatform: 'official-current-recruitment-notices-and-public-pdf-criteria-held',
  countryFilter: 'India',
  paginationStrategy: 'current-own-home-openings-selected-declared-pdfs-opening-closing',
  extractionStrategy:
    'whole-current-native-announcements+selected-declared-public-pdf-binaries+bounded-pinned-text-core+criteria-country-and-company-scope-held',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default HPCL_CATALOG
