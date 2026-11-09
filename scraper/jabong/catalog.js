import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, July 17, 2026 that https://www.jabong.com/ is the exact-name first-party Jabong host, but it currently redirects to https://www.myntra.com/ and renders only the broken shell copy "Oops! Something went wrong" plus "Please contact your administrator". There is no trustworthy public jobs surface on that exact-name first-party host on the verified date, so this provider fails closed and returns no jobs until a trustworthy exact-name public jobs surface becomes visible.'

export const JABONG_CATALOG = {
  source: 'jabong',
  companyName: 'Jabong',
  officialBrandName: 'Jabong',
  adapter: 'script',
  companyCareerPage: 'https://www.jabong.com/',
  homepageUrl: 'https://www.jabong.com/',
  officialParentRedirectUrl: 'https://www.myntra.com/',
  officialErrorPageUrl: 'https://www.myntra.com/',
  companyDomain: 'jabong.com',
  atsPlatform: 'legacy-first-party-redirect-broken-parent-shell',
  countryFilter: 'India',
  paginationStrategy: 'verified-exact-name-host-redirect-plus-broken-parent-shell',
  extractionStrategy:
    'verified-exact-name-host-redirect-to-broken-myntra-shell+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: path.join(currentDir, 'jobs.json'),
  modulePath: path.join(currentDir, 'script.js'),
}

export default JABONG_CATALOG
