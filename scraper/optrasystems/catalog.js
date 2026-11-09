import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, July 17, 2026 that the exact-name Optra Systems domains https://optrasystems.com/ and https://www.optrasystems.com/ did not expose a resolvable public first-party site during direct checks, while the official Optra Ventures portfolio page at https://www.optraventures.com/ still listed Optra Systems separately from Optra HEALTH and referenced www.optrasystems.com as the exact-name company website. No trustworthy public jobs surface was available for the exact-name Optra Systems row on the verified date.'

export const OPTRA_SYSTEMS_CATALOG = {
  source: 'optrasystems',
  companyName: 'Optra Systems',
  officialBrandName: 'Optra Systems',
  adapter: 'script',
  companyCareerPage: 'https://optrasystems.com/',
  exactNamePrimaryDomainUrl: 'https://optrasystems.com/',
  exactNameWwwDomainUrl: 'https://www.optrasystems.com/',
  officialPortfolioReferenceUrl: 'https://www.optraventures.com/',
  companyDomain: 'optrasystems.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'exact-name-domain-resolution-check-plus-official-portfolio-validation',
  extractionStrategy: 'verified-official-portfolio-reference+unresolved-exact-name-domain-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'optrasystems/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default OPTRA_SYSTEMS_CATALOG
