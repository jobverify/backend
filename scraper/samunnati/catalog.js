import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  "Verified on Friday, July 17, 2026 that https://samunnati.com/ and https://samunnati.com/about-us-sam/ are live official Samunnati pages and both expose a public Careers handoff to https://samunnati.darwinbox.in/ms/candidate/careers. Samunnati is currently using that public Darwinbox tenant as its first-party jobs surface, so this provider uses the repo's shared Darwinbox pagination runner for India jobs."

export const SAMUNNATI_CATALOG = {
  source: 'samunnati',
  companyName: 'Samunnati',
  officialBrandName: 'Samunnati',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'samunnati/jobs.json',
  companyCareerPage: 'https://samunnati.com/',
  homepageUrl: 'https://samunnati.com/',
  officialAboutUrl: 'https://samunnati.com/about-us-sam/',
  officialCareersHandoffUrl: 'https://samunnati.darwinbox.in/ms/candidate/careers',
  darwinboxOrigin: 'https://samunnati.darwinbox.in',
  darwinboxCompanyId: 'main',
  companyDomain: 'samunnati.com',
  atsPlatform: 'darwinbox',
  countryFilter: 'India',
  paginationStrategy: 'browser-session-darwinbox-pagination',
  extractionStrategy: 'official-homepage-and-about-page+darwinbox-listing-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default SAMUNNATI_CATALOG
