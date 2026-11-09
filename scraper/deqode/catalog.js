import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 18, 2026 that https://www.deqode.com/career was the live first-party Deqode careers page and exposed one public opening, Python Developer, linking to https://deqode.com/career/python-developer-1 where the role details and first-party application flow were embedded on the company site.'

export const DEQODE_CATALOG = {
  source: 'deqode',
  companyName: 'Deqode',
  officialBrandName: 'Deqode Solutions',
  adapter: 'script',
  homepageUrl: 'https://deqode.com/',
  companyCareerPage: 'https://www.deqode.com/career',
  verifiedSampleJobUrl: 'https://deqode.com/career/python-developer-1',
  verifiedSampleJobTitle: 'Python Developer',
  companyDomain: 'deqode.com',
  atsPlatform: 'official-company-careers-page',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-with-linked-detail-pages',
  extractionStrategy:
    'verified-first-party-careers-page+linked-detail-pages+inline-first-party-apply-flow',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedPublicJobCount: 1,
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'deqode/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default DEQODE_CATALOG
