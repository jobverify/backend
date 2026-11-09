import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, August 14, 2026 that https://www.greenkogroup.com/ remains the live official Greenko Group homepage, ' +
  'that the first-party contact page at https://www.greenkogroup.com/contact.php still exposes a direct Careers link ' +
  'to https://greenkogroup.darwinbox.in/ms/candidatev2/main/careers/allJobs and a Current Openings handoff to ' +
  'https://greenkogroup.darwinbox.in/ms/candidate/careers/, and that the seeded Darwinbox listing API returned 29 India jobs ' +
  'from this environment. Direct TLS-verifying requests to greenkogroup.com failed certificate validation here, so the scraper uses a scoped fallback only for the verified official Greenko HTML pages.'

export const GREENKO_CATALOG = {
  source: 'greenko',
  companyName: 'Greenko',
  officialBrandName: 'Greenko Hub',
  adapter: 'script',
  dryRunFile: 'greenko/jobs.json',
  homepageUrl: 'https://www.greenkogroup.com/',
  companyCareerPage: 'https://www.greenkogroup.com/',
  atsPlatform: 'darwinbox',
  countryFilter: 'India',
  paginationStrategy: 'browser-session-darwinbox-pagination',
  extractionStrategy: 'verified-greenko-homepage-link+darwinbox-listing-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'greenkogroup.com',
  verifiedOn: '2026-08-14',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  modulePath: path.join(currentDir, 'script.js'),
}

export default GREENKO_CATALOG
