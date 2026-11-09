import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SMARTER_BHARAT_CATALOG = {
  source: 'smarterbharat',
  companyName: 'SmarterBharat',
  adapter: 'script',
  companyCareerPage: 'https://smarterbharat.com/',
  homepageUrl: 'https://smarterbharat.com/',
  officialBrandName: 'SmarterBharat',
  atsPlatform: 'exact-name-domains-unresolvable-or-untrusted',
  countryFilter: 'India',
  paginationStrategy: 'candidate-exact-name-domain-resolution-and-trust-validation',
  extractionStrategy:
    'exact-name-first-party-domain-candidates-unresolvable-or-untrusted-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'smarterbharat.com',
  verifiedOn: '2026-07-17',
  candidateFirstPartyUrls: [
    'https://smarterbharat.com/',
    'https://www.smarterbharat.com/',
    'https://smarterbharat.in/',
    'https://www.smarterbharat.in/',
    'https://smarterbharat.ai/',
    'https://www.smarterbharat.ai/',
    'https://smarterbharat.io/',
    'https://www.smarterbharat.io/',
  ],
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that exact-name searches for SmarterBharat careers did not surface a trustworthy public first-party jobs page and instead surfaced neighboring SmartBharat references rather than a stable SmarterBharat hiring surface. Direct probes to https://smarterbharat.com/, https://www.smarterbharat.com/, https://smarterbharat.in/, https://www.smarterbharat.in/, https://smarterbharat.ai/, https://www.smarterbharat.ai/, https://smarterbharat.io/, and https://www.smarterbharat.io/ all failed exact-name verification with Could not resolve host style DNS failures, so there is no trustworthy public jobs surface for SmarterBharat on Friday, July 17, 2026.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default SMARTER_BHARAT_CATALOG
