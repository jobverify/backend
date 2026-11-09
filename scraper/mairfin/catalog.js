import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MAIRFIN_CATALOG = {
  source: 'mairfin',
  companyName: 'Mairfin',
  officialBrandName: 'Mairfin',
  adapter: 'script',
  companyCareerPage: 'https://mairfin.com/',
  homepageUrl: 'https://mairfin.com/',
  companyDomain: 'mairfin.com',
  atsPlatform: 'exact-name-domains-unresolvable-or-untrusted',
  countryFilter: 'India',
  paginationStrategy: 'candidate-exact-name-domain-resolution-and-trust-validation',
  extractionStrategy: 'exact-name-first-party-domain-candidates-unresolvable-or-untrusted-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that exact-name web searches for "Mairfin" and "Mairfin careers" did not surface a trustworthy first-party careers page. Direct live probes to https://mairfin.com/, https://www.mairfin.com/, https://mairfin.in/, and https://www.mairfin.in/ did not yield a trusted public site: curl returned "Could not resolve host" for the exact-name domains, while Windows Invoke-WebRequest also failed with "Could not establish trust relationship for the SSL/TLS secure channel." on the same candidate URLs. There is no trustworthy public jobs surface for Mairfin on Friday, July 17, 2026, so this exact-name sentinel fails closed and returns no jobs until a trusted first-party careers surface is verifiable.',
  candidateFirstPartyUrls: [
    'https://mairfin.com/',
    'https://www.mairfin.com/',
    'https://mairfin.in/',
    'https://www.mairfin.in/',
  ],
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default MAIRFIN_CATALOG
