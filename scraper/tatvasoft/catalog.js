import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, August 14, 2026 that https://www.tatvasoft.com/career is the live first-party TatvaSoft career page, that it currently exposes a Current Openings section with 2 visible openings at https://www.tatvasoft.com/career/business-development-executive and https://www.tatvasoft.com/career/java-developer, and that those detail pages still instruct candidates to apply via career@tatvasoft.com. This exact-name provider uses the verified first-party career page plus first-party role detail pages and fail-closes if either public surface drifts.'

export const TATVASOFT_CATALOG = {
  source: 'tatvasoft',
  companyName: 'TatvaSoft',
  officialBrandName: 'TatvaSoft',
  adapter: 'script',
  homepageUrl: 'https://www.tatvasoft.com/',
  companyCareerPage: 'https://www.tatvasoft.com/career',
  applicationEmail: 'career@tatvasoft.com',
  applicationUrl: 'mailto:career@tatvasoft.com',
  verifiedOpeningUrls: [
    'https://www.tatvasoft.com/career/business-development-executive',
    'https://www.tatvasoft.com/career/java-developer',
  ],
  companyDomain: 'tatvasoft.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'first-party-careers-page-plus-role-detail-pages',
  extractionStrategy: 'verified-careers-page+first-party-role-detail-pages+mailto-application',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-14',
  verifiedPublicOpeningCount: 2,
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'tatvasoft/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default TATVASOFT_CATALOG
