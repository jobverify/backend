import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 25, 2026 that https://www.cdn77.jobs/ was CDN77\'s live first-party jobs page, that the page title was Práce v CDN77.com | CDN77.jobs, that the page metadata still branded the hiring surface as CDN77 while listing (c) 2026 DataCamp Limited as the legal entity, and that the visible Všechny nabídky counter and public listing cards exposed 16 current openings, all located in Praha 10, Česko. No India roles were visible on the verified first-party jobs surface, so this provider currently returns an honest empty India slice while the trusted public surface remains unchanged.'

export const CDN77_CATALOG = {
  source: 'cdn77',
  companyName: 'CDN77',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'cdn77/jobs.json',
  companyCareerPage: 'https://www.cdn77.jobs/',
  companyDomain: 'cdn77.jobs',
  verifiedPublicJobCount: 16,
  verifiedIndiaJobCount: 0,
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-server-rendered-jobs-page',
  extractionStrategy:
    'verified-first-party-jobs-page+server-rendered-job-cards+visible-count-validation+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-25',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default CDN77_CATALOG
