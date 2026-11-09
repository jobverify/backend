import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOSTRONK_CATALOG = {
  source: 'sostronk',
  companyName: 'Sostronk',
  adapter: 'script',
  companyCareerPage: 'https://www.sostronk.com/',
  homepageUrl: 'https://www.sostronk.com/',
  changelogUrl: 'https://changelog.sostronk.com/',
  officialBrandName: 'SoStronk',
  coFounderName: 'Karan',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'exact-name-first-party-route-blocked-surface-validation',
  extractionStrategy:
    'search-indexed-first-party-changelog-plus-exact-name-first-party-routes-tls-blocked-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'sostronk.com',
  verifiedOn: '2026-07-27',
  firstPartyTimeoutUrls: [
    'https://www.sostronk.com/',
    'https://www.sostronk.com/about',
    'https://www.sostronk.com/careers',
    'https://www.sostronk.com/jobs',
    'https://www.sostronk.com/contact',
    'https://changelog.sostronk.com/',
  ],
  verifiedSurfaceSummary:
    'Verified on Monday, July 27, 2026 that search-indexed first-party evidence for SoStronk still includes the branded changelog at https://changelog.sostronk.com/ with SoStronk release notes text and the signature Karan, Co-Founder & CTO, while direct probes to https://www.sostronk.com/, https://www.sostronk.com/about, https://www.sostronk.com/careers, https://www.sostronk.com/jobs, and https://www.sostronk.com/contact consistently fail during TLS setup with ECONNRESET before a secure connection is established. There is no trustworthy public jobs surface for Sostronk on Monday, July 27, 2026.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default SOSTRONK_CATALOG
