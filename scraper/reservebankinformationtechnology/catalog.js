import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const RESERVE_BANK_INFORMATION_TECHNOLOGY_CATALOG = {
  source: 'reservebankinformationtechnology',
  companyName: 'Reserve Bank Information Technology',
  officialBrandName: 'ReBIT',
  adapter: 'script',
  homepageUrl: 'https://rebit.org.in/',
  companyCareerPage: 'https://rebit.org.in/careers/',
  careersPortalBaseUrl: 'https://rebithr.darwinbox.in/ms/candidatev2/main/careers/',
  companyDomain: 'rebit.org.in',
  atsPlatform: 'first-party-careers-spa-authenticated-api',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-current-openings-api',
  extractionStrategy:
    'verified-first-party-careers-spa+authenticated-current-openings-api+darwinbox-apply-links+experience-field',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary:
    'Verified on 2026-10-03: https://rebit.org.in/careers/ publishes its current main client and API configuration on the same first-party origin. The current public anonymous bootstrap payload succeeds at https://rebit.org.in/web/api/auth/login; the single https://rebit.org.in/web/api/current-openings feed returns 14 active India openings with explicit current job_experience and trusted https://rebithr.darwinbox.in apply URLs. All 14 apply shells identify Reserve Bank Information Technology Pvt Ltd; detail APIs return Cloudflare 403, so missing full descriptions remain null. Published byte-to-base64 bindings are read from the current client rather than retained as old constants.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'reservebankinformationtechnology/jobs.json',
}

export default RESERVE_BANK_INFORMATION_TECHNOLOGY_CATALOG
