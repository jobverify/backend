import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const UNITED_ALLIANCE_TECHNOLOGY_CATALOG = {
  source: 'unitedalliancetechnology',
  companyName: 'United Alliance Technology',
  officialBrandName: 'United Alliance Technology',
  adapter: 'script',
  homepageUrl: 'https://unitedalliancetechnology.com/',
  companyCareerPage: 'https://unitedalliancetechnology.com/',
  officialCareersPageUrl: 'https://unitedalliancetechnology.com/',
  companyDomain: 'unitedalliancetechnology.com',
  atsPlatform: 'official-company-domain-unreachable',
  countryFilter: 'India',
  paginationStrategy: 'single-exact-domain-probe',
  extractionStrategy: 'exact-name-domain-dns-failure-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that repeated probes to the exact-name first-party domain https://unitedalliancetechnology.com/ failed with "Could not resolve host", so no trustworthy public careers surface was reachable and the local provider is pinned to return empty only while that exact-name first-party domain remains unresolved.',
  dryRunFile: 'unitedalliancetechnology/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default UNITED_ALLIANCE_TECHNOLOGY_CATALOG
