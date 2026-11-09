import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://dsqsoftware.com/, https://www.dsqsoftware.com/, https://dsqsoftware.com/careers, https://www.dsqsoftware.com/careers, https://dsqsoftware.com/jobs, https://www.dsqsoftware.com/jobs, https://dsqsoftware.co.in/, https://www.dsqsoftware.co.in/, https://dsqsoftware.co.in/careers, https://www.dsqsoftware.co.in/careers, https://dsqworld.com/, https://www.dsqworld.com/, https://dsqworld.com/careers, and https://www.dsqworld.com/careers were all unreachable because their hostnames did not resolve, while Resolve-DnsName also returned DNS name does not exist for dsqsoftware.com, dsqsoftware.co.in, dsqworld.com, and their www/careers/jobs subdomains. No trustworthy public first-party jobs surface was reachable.'

export const DSQ_SOFTWARE_CATALOG = {
  source: 'dsqsoftware',
  companyName: 'DSQ Software',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'dsqsoftware/jobs.json',
  companyCareerPage: 'https://dsqsoftware.com/',
  companyDomain: 'dsqsoftware.com',
  atsPlatform: 'official-company-site-unresolved',
  countryFilter: 'India',
  paginationStrategy: 'dns-resolution-check',
  extractionStrategy:
    'verified-dsqsoftware-and-dsqworld-first-party-hosts-unresolved-return-empty-until-official-surface-exists',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default DSQ_SOFTWARE_CATALOG
