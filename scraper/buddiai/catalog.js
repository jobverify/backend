import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, August 1, 2026 that https://buddi.ai/careers.html is the live first-party BUDDI.AI careers page, that it still publicly lists Chennai healthcare roles including Team Leader, Manager, and Medical Coders inside the current blurbs-based layout, and that the same static page also shows non-India engineering roles such as Principle Software Application Architect in San Francisco. This company therefore uses a real first-party static-page scraper with an India location filter.'

export const BUDDI_AI_CATALOG = {
  source: 'buddiai',
  companyName: 'BUDDI.AI',
  officialBrandName: 'BUDDI.AI',
  adapter: 'script',
  homepageUrl: 'https://buddi.ai/',
  companyCareerPage: 'https://buddi.ai/careers.html',
  companyDomain: 'buddi.ai',
  atsPlatform: 'official-first-party-static-careers-page',
  countryFilter: 'India',
  paginationStrategy: 'single-static-careers-page',
  extractionStrategy: 'static-blurbs-and-role-sections+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-01',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'buddiai/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default BUDDI_AI_CATALOG
