import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const NEXVAL_INFOTECH_CATALOG = {
  source: 'nexvalinfotech',
  companyName: 'Nexval Infotech',
  officialBrandName: 'Nexval',
  adapter: 'script',
  homepageUrl: 'https://www.nexval.ai/',
  companyCareerPage: 'https://www.nexval.ai/careers/',
  legacyCareerPageUrl: 'https://nexval.com/careers/',
  companyDomain: 'nexval.ai',
  atsPlatform: 'no-public-jobs-surface',
  countryFilter: 'Global',
  paginationStrategy: 'fail-closed-no-current-careers-surface',
  extractionStrategy: 'verified-current-homepage+careers-routes-403+legacy-careers-domain-timeout+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-03',
  verifiedSurfaceSummary:
    'Verified on Monday, August 3, 2026 that https://www.nexval.ai/ was the live official Nexval homepage with the AI-First Mortgage BPO, Products & Cloud Services title and current first-party Nexval contact markers, that https://www.nexval.ai/careers/, https://www.nexval.ai/career/, https://www.nexval.ai/jobs/, and https://www.nexval.ai/join-us/ each returned 403 AccessDenied responses, and that the historical legacy route https://nexval.com/careers/ timed out instead of redirecting. Search results still exposed stale historical nexval.com careers content, but the live official domain no longer publishes a trustworthy public jobs surface.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default NEXVAL_INFOTECH_CATALOG
