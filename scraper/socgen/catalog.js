import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Monday, July 27, 2026 that the live SocGen public jobs surface is still the official Societe Generale ' +
  'careers page at https://careers.societegenerale.com/en/Technical/all-job-offers, which displayed "702 offre(s)" ' +
  'on the verified date and included India listings such as "Senior Analyst" in Bangalore, India and ' +
  '"Delivery Manager" in Chennai, India. The public detail pages continue to hand applicants to Taleo apply links on socgen.taleo.net.'

export const SOCGEN_CATALOG = {
  source: 'socgen',
  companyName: 'SocGen',
  officialBrandName: 'Societe Generale',
  adapter: 'script',
  dryRunFile: 'socgen/jobs.json',
  companyCareerPage: 'https://careers.societegenerale.com/en/Technical/all-job-offers',
  verifiedLiveOfferCount: 702,
  verifiedIndiaSampleTitle: 'Senior Analyst',
  atsPlatform: 'oracle-taleo',
  countryFilter: 'India',
  paginationStrategy: 'single-public-listing-page-plus-detail-pages',
  extractionStrategy: 'verified-socgen-careers-page+official-careers-listing+detail-pages+taleo-apply-handoff',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'careers.societegenerale.com',
  verifiedOn: '2026-07-27',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  modulePath: path.join(currentDir, 'script.js'),
}

export default SOCGEN_CATALOG
