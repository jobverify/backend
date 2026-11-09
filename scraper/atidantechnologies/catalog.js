import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ATIDAN_TECHNOLOGIES_CATALOG = {
  source: 'atidantechnologies',
  companyName: 'Atidan Technologies',
  officialBrandName: 'Atidan Technologies Pvt. Ltd.',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'atidantechnologies/jobs.json',
  companyCareerPage: 'https://atidantech.com/careers/',
  companyDomain: 'atidantech.com',
  atsPlatform: 'official-first-party-job-posts',
  countryFilter: 'India',
  paginationStrategy: 'single-careers-archive-plus-linked-role-pages',
  extractionStrategy:
    'verified-official-careers-archive+verified-role-detail-pages+remote-role-normalization',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://atidantech.com/careers/ is the live first-party Atidan Technologies careers archive and that it publicly lists dated role posts including SCCM L3 Engineer and ServiceNow HRSD Developer. Verified that linked first-party detail pages on atidantech.com expose public location, experience, functional area, and responsibilities, so the local scraper follows those role pages and normalizes the remote jobs to India.',
}

export default ATIDAN_TECHNOLOGIES_CATALOG
