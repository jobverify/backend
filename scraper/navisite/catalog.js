import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const NAVISITE_CATALOG = {
  source: 'navisite',
  companyName: 'NaviSite',
  officialBrandName: 'Navisite, Part of Accenture',
  adapter: 'script',
  homepageUrl: 'https://www.navisite.com/',
  companyCareerPage: 'https://www.navisite.com/about/careers/',
  parentCareersUrl: 'https://www.accenture.com/us-en/careers',
  atsPlatform: 'official-careers-parent-search-handoff',
  countryFilter: 'Global',
  paginationStrategy: 'first-party-handoff-page-or-blocked-shell-validation',
  extractionStrategy:
    'verified-first-party-navisite-handoff-or-cloudflare-blocked-shell+opaque-accenture-search-flow+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'navisite.com',
  verifiedOn: '2026-08-13',
  verifiedSurfaceSummary:
    'Verified on Thursday, August 13, 2026 that https://www.navisite.com/about/careers/ currently returns a Cloudflare "Just a moment..." challenge shell with HTTP 403. The previously verified first-party Navisite careers surface historically instructed candidates to use the Accenture Careers page at https://www.accenture.com/us-en/careers and search "Navisite" for open roles, but the current public inventory is not trustworthily enumerable from the blocked first-party route or the opaque parent search flow, so this provider remains fail-closed and returns an empty sentinel.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'navisite/jobs.json',
}

export default NAVISITE_CATALOG
