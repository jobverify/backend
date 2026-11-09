import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SHIPROCKET_CATALOG = {
  source: 'shiprocket',
  companyName: 'Shiprocket',
  officialBrandName: 'Shiprocket',
  adapter: 'script',
  companyCareerPage: 'https://careers.shiprocket.in/',
  officialCareersPageUrl: 'https://careers.shiprocket.in/',
  jobPagePrefix: 'https://careers.shiprocket.in/jobs/',
  companyDomain: 'shiprocket.in',
  atsPlatform: 'first-party-html-board',
  countryFilter: 'India',
  paginationStrategy: 'single-public-page+first-party-detail-pages',
  extractionStrategy: 'verified-first-party-careers-page+visible-job-list+first-party-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that the official Shiprocket public hiring surface for this exact-name provider was the first-party careers page at https://careers.shiprocket.in/ and its first-party detail pages under https://careers.shiprocket.in/jobs/. The verified careers page exposed public listings including GoLang Developer, Central Analytics Lead, and Sr. Manager- Supply (FTL & PTL), and those listings resolved to first-party detail pages such as https://careers.shiprocket.in/jobs/golang-developer/ with public role content plus an embedded application form.',
  dryRunFile: 'shiprocket/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SHIPROCKET_CATALOG
