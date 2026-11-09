import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 25, 2026 that Porsche\'s official career portal at https://jobs.porsche.com/?ac=start&language=2 is live and exposes a JavaScript-backed search shell, but no enumerable India-specific Porsche Engineering public listing surface was identified. The official Porsche Engineering company description lists subsidiaries in Germany, Czech Republic, Italy, Romania, and China, not India; Porsche India is a separate vehicle-importer entity. This exact-name provider therefore fails closed and returns no jobs until a trustworthy India-specific first-party listing surface appears.'

export const PORSCHE_ENGINEERING_INDIA_CATALOG = {
  source: 'porscheengineeringindia',
  companyName: 'Porsche Engineering India',
  officialBrandName: 'Porsche Engineering India',
  adapter: 'script',
  homepageUrl: 'https://www.porscheengineering.com/en/peg/',
  companyCareerPage: 'https://jobs.porsche.com/?ac=start&language=2',
  officialCareersPageUrl: 'https://jobs.porsche.com/?ac=start&language=2',
  companyDomain: 'porscheengineering.com',
  atsPlatform: 'official-porsche-career-portal-non-enumerable-india-surface',
  countryFilter: 'India',
  paginationStrategy: 'official-career-portal-shell-without-enumerable-india-listings',
  extractionStrategy:
    'verified-official-porsche-career-portal-shell+no-india-specific-public-listings+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-25',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'porscheengineeringindia/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default PORSCHE_ENGINEERING_INDIA_CATALOG
