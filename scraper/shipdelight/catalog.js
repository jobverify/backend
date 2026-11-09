import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SHIPDELIGHT_CATALOG = {
  source: 'shipdelight',
  companyName: 'Shipdelight',
  officialBrandName: 'Shipdelight Logistics Technologies Pvt Ltd.',
  adapter: 'script',
  companyCareerPage: 'https://shipdelight.com/career',
  officialCareersPageUrl: 'https://shipdelight.com/career',
  companyDomain: 'shipdelight.com',
  atsPlatform: 'first-party-empty-careers-page',
  countryFilter: 'India',
  paginationStrategy: 'single-public-page',
  extractionStrategy: 'verified-first-party-careers-page+verified-empty-openings-state',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that the official Shipdelight careers page at https://shipdelight.com/career was the live first-party public hiring surface for this exact-name provider. The verified page exposed a Current Job Openings section with the explicit empty-state message "No open position available!", so this provider is intentionally fail-closed and returns an honest empty list until the same verified first-party surface exposes trustworthy public openings.',
  dryRunFile: 'shipdelight/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SHIPDELIGHT_CATALOG
