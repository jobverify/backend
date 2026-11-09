import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, August 1, 2026 that Cyveritas public references still pointed to https://cyveritas.com/, but https://cyveritas.com/, https://cyveritas.com/careers, https://www.cyveritas.com/, and https://www.cyveritas.com/careers were unreachable because their hostnames did not resolve, while Resolve-DnsName returned DNS name does not exist for cyveritas.com and www.cyveritas.com. No newer first-party replacement domain or trustworthy public jobs surface could be verified.'

export const CYVERITAS_CATALOG = {
  source: 'cyveritas',
  companyName: 'Cyveritas Risk Advisory Pvt. Ltd',
  officialBrandName: 'Cyveritas Risk Advisory Private Limited',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'cyveritas/jobs.json',
  homepageUrl: 'https://cyveritas.com/',
  companyCareerPage: 'https://cyveritas.com/careers',
  officialCareersPageUrl: 'https://cyveritas.com/careers',
  companyDomain: 'cyveritas.com',
  atsPlatform: 'official-company-site-unresolved',
  countryFilter: 'India',
  paginationStrategy: 'canonical-first-party-host-resolution-validation',
  extractionStrategy: 'verified-canonical-first-party-hosts-unresolved-return-empty-until-official-surface-exists',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-01',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default CYVERITAS_CATALOG
