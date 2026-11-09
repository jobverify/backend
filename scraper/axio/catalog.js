import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://www.axio.co.in/ is the live first-party Axio homepage and that https://www.axio.co.in/about-us is the first-party page currently exposing the public careers handoff via a "Join our team" link to https://axiofinance.darwinbox.in/ms/candidate/careers. Verified that https://axiofinance.darwinbox.in/jobs resolves to the public Darwinbox portal at https://axiofinance.darwinbox.in/ms/candidatev2/main/careers/home and that the public jobs shell is hosted at https://axiofinance.darwinbox.in/ms/candidatev2/main/careers/allJobs. Direct non-browser requests to the Darwinbox candidate API were Cloudflare-protected during verification, so this scraper uses the repo\'s existing browser-session Darwinbox pagination pattern.'

export const AXIO_CATALOG = {
  source: 'axio',
  companyName: 'Axio',
  officialBrandName: 'axio',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'axio/jobs.json',
  companyCareerPage: 'https://www.axio.co.in/about-us',
  homepageUrl: 'https://www.axio.co.in/',
  officialCareersHandoffUrl: 'https://axiofinance.darwinbox.in/ms/candidate/careers',
  darwinboxOrigin: 'https://axiofinance.darwinbox.in',
  darwinboxCompanyId: 'main',
  companyDomain: 'axio.co.in',
  atsPlatform: 'darwinbox',
  countryFilter: 'India',
  paginationStrategy: 'browser-session-darwinbox-pagination',
  extractionStrategy: 'official-about-us-page+darwinbox-listing-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default AXIO_CATALOG
