import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const NTRUST_INFOTECH_CATALOG = {
  source: 'ntrustinfotech',
  companyName: 'Ntrust Infotech',
  officialBrandName: 'NTrust Infotech',
  adapter: 'script',
  companyCareerPage: 'https://ntrustinfotech.com/careers/',
  companyDomain: 'ntrustinfotech.com',
  atsPlatform: 'first-party-careers-page-generic-ats-handoff',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-page-with-placeholder-role-cards',
  extractionStrategy:
    'verified-first-party-careers-copy+placeholder-role-cards-with-href-hash+generic-ats-note+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://ntrustinfotech.com/careers/ was the exact-name NTrust careers page, that its role cards such as Engineering & Data Science rendered with href="#" placeholders, and that the page only said live openings were listed in an applicant tracking system without exposing trustworthy public NTrust job links, so this provider remains fail-closed.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'ntrustinfotech/jobs.json',
}

export default NTRUST_INFOTECH_CATALOG
