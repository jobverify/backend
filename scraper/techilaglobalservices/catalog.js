import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TECHILA_GLOBAL_SERVICES_CATALOG = {
  source: 'techilaglobalservices',
  companyName: 'Techila Global Services',
  officialBrandName: 'Techila Global Services',
  adapter: 'script',
  homepageUrl: 'https://techilaservices.com/',
  companyCareerPage: 'https://techilaservices.com/careers',
  companyDomain: 'techilaservices.com',
  atsPlatform: 'nextjs-jobposting-detail-pages',
  countryFilter: 'India',
  paginationStrategy: 'server-rendered-job-list-plus-detail-pages',
  extractionStrategy:
    'verified-first-party-open-roles-list+detail-pages+jobposting-jsonld+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://techilaservices.com/careers remained the live first-party Techila careers board, rendered a Current openings list showing 196 positions across offices and disciplines, exposed first-party detail routes such as /careers/6a5a2e30e82b6002f9cf351d, and that those detail pages published JobPosting JSON-LD for India roles including Data Scientist in Pune.',
  dryRunFile: 'techilaglobalservices/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default TECHILA_GLOBAL_SERVICES_CATALOG
