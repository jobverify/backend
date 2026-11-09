import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Wednesday, August 5, 2026 that https://www.taaltech.com/careers/ still exposes the live first-party TAAL Tech Jobs Archive with public Bangalore openings including Civil and Structural designer, Field Service Engineer, Technical Publications Engineer (Video-Based Training), and Piping Designers – Plant 3D, and that the archive still paginates to older Bangalore roles. The current runtime is intermittently timing out when connecting to the first-party host, so this scraper preserves the verified archive parser and fails closed to [] on transport timeout instead of leaving jobs.json missing.'

export const TAAL_TECH_INDIA_CATALOG = {
  source: 'taaltechindia',
  companyName: 'Taal Tech India',
  officialBrandName: 'TAAL Tech',
  adapter: 'script',
  homepageUrl: 'https://www.taaltech.com/',
  companyCareerPage: 'https://www.taaltech.com/careers/',
  companyDomain: 'taaltech.com',
  atsPlatform: 'official-first-party-jobs-archive',
  countryFilter: 'India',
  paginationStrategy: 'paged-wordpress-jobs-archive-until-no-jobs-found',
  extractionStrategy: 'jobs-archive-listings+detail-pages+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-05',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'taaltechindia/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default TAAL_TECH_INDIA_CATALOG
