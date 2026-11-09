import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PHARMEASY_CATALOG = {
  source: 'pharmeasy',
  companyName: 'PharmEasy',
  officialBrandName: 'PharmEasy',
  adapter: 'script',
  companyCareerPage: 'https://pharmeasy.in/careers/',
  companyDomain: 'pharmeasy.in',
  atsPlatform: 'darwinbox',
  countryFilter: 'India',
  paginationStrategy: 'browser-session-darwinbox-pagination',
  extractionStrategy: 'official-careers-page+darwinbox-listing-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  officialCareersHandoffUrl: 'https://myhr.darwinbox.in/ms/candidate/careers',
  darwinboxOrigin: 'https://myhr.darwinbox.in',
  darwinboxCompanyId: 'main',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://pharmeasy.in/careers/ is the live first-party PharmEasy careers page and that it explicitly sends applicants to the official Darwinbox handoff at https://myhr.darwinbox.in/ms/candidate/careers via visible Start Applying calls-to-action. Verified that https://pharmeasy.in/careers/jobs/ currently says "We\'re currently updating open positions on the website. Please check back soon." while the public Darwinbox portal at https://myhr.darwinbox.in/ms/candidatev2/main/careers/allJobs still exposes live India openings, including the public job detail page https://myhr.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a39234c7fe21. Direct non-browser requests to the Darwinbox candidate API were Cloudflare-protected during verification, so this scraper uses the repo\'s browser-session Darwinbox pagination pattern.',
  dryRunFile: 'pharmeasy/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default PHARMEASY_CATALOG
