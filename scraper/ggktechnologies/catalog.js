import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 18, 2026 that https://ggktech.com/ returned a first-party 301 redirect to https://innovasolutions.com/, and the redirect target rendered Innova Solutions branding plus non-GGK location-based career handoffs. No GGK-branded public careers surface or GGK job listings were exposed from the assigned first-party domain, so this provider is fail-closed.'

export const GGK_TECHNOLOGIES_CATALOG = {
  source: 'ggktechnologies',
  companyName: 'GGK Technologies',
  officialBrandName: 'GGK Technologies',
  adapter: 'script',
  homepageUrl: 'https://ggktech.com/',
  companyCareerPage: 'https://ggktech.com/',
  redirectTargetUrl: 'https://innovasolutions.com/',
  companyDomain: 'ggktech.com',
  atsPlatform: 'redirected-first-party-homepage-contract',
  countryFilter: 'India',
  paginationStrategy: 'root-domain-redirect-without-ggk-job-listings',
  extractionStrategy: 'verified-domain-redirect-to-foreign-brand-homepage-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'ggktechnologies/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default GGK_TECHNOLOGIES_CATALOG
