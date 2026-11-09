import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SIGNEASY_CATALOG = {
  source: 'signeasy',
  companyName: 'SignEasy',
  officialBrandName: 'Signeasy',
  adapter: 'script',
  companyCareerPage: 'https://signeasy.com/careers',
  officialCareersPageUrl: 'https://signeasy.com/careers',
  companyDomain: 'signeasy.com',
  atsPlatform: 'recruiterbox-trakstar-widget',
  countryFilter: 'India',
  paginationStrategy: 'official-widget-complete-openings-feed',
  extractionStrategy: 'verified-first-party-widget-14690+recruiterbox-openings+trakstar-role-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary:
    'Verified on October 3, 2026 that the official Signeasy careers page embeds Recruiterbox widget 14690, whose public openings feed lists four Bengaluru roles with matching Trakstar application pages.',
  dryRunFile: 'signeasy/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SIGNEASY_CATALOG
