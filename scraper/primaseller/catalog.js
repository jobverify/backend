import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PRIMASELLER_CATALOG = {
  source: 'primaseller',
  companyName: 'Primaseller',
  officialBrandName: 'Primaseller',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'primaseller/jobs.json',
  homepageUrl: 'https://www.primaseller.com/',
  companyCareerPage: 'https://www.primaseller.com/',
  legacyAboutPageUrl: 'https://help.primaseller.com/about-us',
  legacyFsLinkUrl: 'https://fslink.primaseller.com/',
  redirectTargetUrl: 'https://www.delhivery.com/solutions/d2c-brands',
  companyDomain: 'primaseller.com',
  atsPlatform: 'exact-name-homepage-redirect-plus-legacy-subdomain-tls-failure',
  countryFilter: 'India',
  paginationStrategy: 'redirect-validation-plus-legacy-subdomain-tls-failure-validation',
  extractionStrategy:
    'verified-homepage-redirect-to-delhivery+verified-help-and-fslink-expired-tls-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.primaseller.com/ resolves to the generic Delhivery D2C brands page at https://www.delhivery.com/solutions/d2c-brands rather than an exact-name Primaseller careers surface. Also verified that direct HTTPS probes to the remaining exact-name first-party Primaseller subdomains at https://help.primaseller.com/about-us and https://fslink.primaseller.com/ failed with expired TLS certificate errors, so no trustworthy public jobs surface was exposed for the exact-name Primaseller brand.',
}

export default PRIMASELLER_CATALOG
