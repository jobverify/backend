import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://apna.co/careers redirects to the live first-party careers host at https://careers.apna.co/, that the country-filtered feed at https://careers.apna.co/jobs.md?location[0][country]=India exposes current India openings on Apna\'s custom-domain Workable board, and that detail token 95D6F2526C resolves to the first-party job URL https://careers.apna.co/_/j/95D6F2526C.'

export const APNA_CATALOG = {
  source: 'apna',
  companyName: 'Apna',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'apna/jobs.json',
  companyCareerPage: 'https://careers.apna.co/',
  companyDomain: 'apna.co',
  atsPlatform: 'first-party-custom-domain-workable',
  countryFilter: 'India',
  paginationStrategy: 'first-party-careers-route-plus-country-filtered-markdown-feed',
  extractionStrategy:
    'verified-careers-handoff+country-filtered-custom-domain-workable-markdown-feed+custom-domain-apply-urls',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  homepageUrl: 'https://apna.co/',
  careersEntryUrl: 'https://apna.co/careers',
  jobsFeedUrl: 'https://careers.apna.co/jobs.md?location[0][country]=India',
  verifiedJobUrl: 'https://careers.apna.co/_/j/95D6F2526C',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default APNA_CATALOG
