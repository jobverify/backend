import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  "Reviewed November 14, 2026: the literal first-party Drip Capital India careers View Jobs declaration leads through the exact Recruiterbox301 to its own Trakstar board. Complete original raw document segments, native publisher/role IDs/countries, full original criteria HTML and all authored application questions are retained for the finite reviewed five-card cohort and four India text pairs. Publication and expiry dates are absent. External client/CSS/rendered/application qualification, whole-company scope and lifecycle cleanup remain held; future unreviewed document changes are coverage gaps, never verified empty inventory."

export const DRIP_CAPITAL_CATALOG = {
  source: 'dripcapital',
  companyName: 'Drip Capital',
  officialBrandName: 'Drip Capital',
  adapter: 'script',
  homepageUrl: 'https://www.dripcapital.com/',
  companyCareerPage: 'https://www.dripcapital.com/en-in/careers/',
  careersPageUrl: 'https://www.dripcapital.com/en-in/careers/',
  legacyCareersPageUrl: 'https://www.dripcapital.com/careers/',
  usCareersPageUrl: 'https://www.dripcapital.com/en-us/careers/',
  legacyCareersPayloadUrl: 'https://assets.dripcapital.com/_nuxt/static/1786337464/careers/payload.js',
  indiaCareersPayloadUrl: 'https://assets.dripcapital.com/_nuxt/static/1786337464/en-in/careers/payload.js',
  usCareersPayloadUrl: 'https://assets.dripcapital.com/_nuxt/static/1786337464/en-us/careers/payload.js',
  jobsPageUrl: 'https://www.dripcapital.com/jobs',
  robotsTxtUrl: 'https://www.dripcapital.com/robots.txt',
  sitemapUrl: 'https://www.dripcapital.com/sitemap.xml',
  companyDomain: 'dripcapital.com',
  atsPlatform: 'trakstar-hire',
  countryFilter: 'India',
  paginationStrategy:
    'exact-declared-native-board-plus-four-india-text-pairs-and-equal-closing-handoff-inventory',
  extractionStrategy:
    'literal-corporate-recruiterbox301-own-trakstar-finite-raw-entity-native-text',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-11-14',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'dripcapital/jobs.json',
  modulePath: path.resolve(currentDir, 'nativeCareers20261114.js'),
  sourceScopeComplete: false,
  lifecycleCleanupAllowed: false,
  sourceActivationComplete: false,
  sourceRenderedCriteriaComplete: false,
  sourceApplicationQualificationComplete: false,
}

export default DRIP_CAPITAL_CATALOG
