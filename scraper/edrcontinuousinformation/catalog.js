import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 18, 2026 that https://www.edrinfo.net/ is the live exact-name first-party EDR Continuous Information homepage and that it exposes generic company navigation such as "Why EDR", "Global Resources At Your Command", and "Contact Us" rather than a public careers board. Standard exact-name careers routes on the same first-party domain, including /careers, /jobs, and /join-us, returned HTTP 404 during live verification. No trustworthy first-party public jobs surface was confirmed, so this provider stays fail-closed and returns an empty set until EDR publishes a verifiable exact-name careers page.'

export const EDR_CONTINUOUS_INFORMATION_CATALOG = {
  source: 'edrcontinuousinformation',
  companyName: 'EDR Continuous Information',
  officialBrandName: 'EDR',
  adapter: 'script',
  homepageUrl: 'https://www.edrinfo.net/',
  companyCareerPage: 'https://www.edrinfo.net/',
  companyDomain: 'edrinfo.net',
  atsPlatform: 'official-homepage-without-careers-surface',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-common-careers-route-validation',
  extractionStrategy:
    'verified-official-homepage-without-public-careers-or-jobs-surface-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'edrcontinuousinformation/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default EDR_CONTINUOUS_INFORMATION_CATALOG
