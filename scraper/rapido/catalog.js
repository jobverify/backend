import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const RAPIDO_CATALOG = {
  source: 'rapido',
  companyName: 'Rapido',
  officialBrandName: 'Rapido',
  adapter: 'script',
  companyCareerPage: 'https://www.rapido.bike/Careers',
  officialCareersPageUrl: 'https://www.rapido.bike/Careers',
  officialCareersHandoffUrl: 'https://rapido.darwinbox.in/ms/candidate/careers',
  darwinboxOrigin: 'https://rapido.darwinbox.in',
  darwinboxCompanyId: 'main',
  companyDomain: 'rapido.bike',
  atsPlatform: 'darwinbox',
  countryFilter: 'India',
  paginationStrategy: 'browser-session-darwinbox-pagination',
  extractionStrategy: 'official-careers-page+darwinbox-listing-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.rapido.bike/Careers was the live first-party Rapido careers page and that its View Jobs call-to-action handed job seekers to the official Darwinbox candidate portal at https://rapido.darwinbox.in/ms/candidate/careers. Verified that direct non-browser requests to the Darwinbox listing API were Cloudflare-blocked on the verified date, so this exact-name provider uses the repo’s existing browser-session Darwinbox pagination pattern.',
  dryRunFile: 'rapido/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default RAPIDO_CATALOG
