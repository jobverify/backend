import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  "Current corporate careers declares 13 category routes plus a public hiring intake. Missing/misdirected categories and two public role/campaign descriptions are retained as incomplete observations. Your-city/Indian-education-market text is not country proof; generic Sales campaign and thank-you text do not invent a job title. Document dates remain original document evidence. The current native vacancy total and role eligibility remain unknown; no whole-company absence is asserted."

export const BYJUS_CATALOG = {
  source: 'byjus',
  companyName: "BYJU'S",
  officialBrandName: "BYJU'S",
  adapter: 'script',
  homepageUrl: 'https://byjus.com/',
  companyCareerPage: 'https://byjus.com/careers-at-byjus/',
  careerPageUrl: 'https://byjus.com/careers-at-byjus/',
  salesCategoryRouteUrl: 'https://byjus.com/careers/all-openings/job-category/sales/',
  salesApplyUrl: 'https://byjus.com/sales-apply/',
  misdirectedTechRouteUrl: 'https://byjus.com/careers/all-openings/job-category/tech/',
  misdirectedTechFinalUrl: 'https://byjus.com/chemistry/technetium/',
  sitemapUrl: 'https://byjus.com/sitemap.xml',
  checkedMissingRouteUrls: [
    'https://byjus.com/jobs/',
    'https://byjus.com/careers/all-openings/',
    'https://byjus.com/careers/all-openings/job-category/academics/',
  ],
  companyDomain: 'byjus.com',
  atsPlatform: 'official-company-careers-broken-routes',
  countryFilter: 'India',
  paginationStrategy: "current-declared-category-and-public-intake-routes+closing-careers-links",
  extractionStrategy:
    "current-careers-identity+declared-route-status+raw-public-role-campaign-criteria;unknown-vacancy-inventory",
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: null,
  verifiedAt: null,
  verifiedPublicJobCount: null,
  verifiedIndiaJobCount: null,
  sourceScopeComplete: false,
  lifecycleCleanupAllowed: false,
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'byjus/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default BYJUS_CATALOG
