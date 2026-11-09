import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const FOCUS_SOFTNET_CATALOG = {
  source: 'focussoftnet',
  companyName: 'Focus Softnet',
  officialBrandName: 'Focus Softnet',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  homepageUrl: 'https://www.focussoftnet.com/',
  companyCareerPage: 'https://www.focussoftnet.com/careers',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-landing-page',
  extractionStrategy: 'verified-first-party-careers-page-inline-role-cards',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'focussoftnet.com',
  dryRunFile: 'focussoftnet/jobs.json',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary:
    'Verified on Sunday, August 2, 2026 that https://www.focussoftnet.com/careers was the live first-party Focus Softnet careers page. The page exposed the Join Our Global Team shell, inline role cards for Sales Consultant - CRM/ERP/HCM and Social Media Specialist, and the shared Apply for Career form on the same first-party surface.',
}

export default FOCUS_SOFTNET_CATALOG
