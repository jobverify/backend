import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://www.ecomexpress.in/, https://www.ecomexpress.in/careers/, https://www.ecomexpress.in/jobs/, https://www.ecomexpress.in/career/, and https://www.ecomexpress.in/work-with-us/ all served the same Delhivery X Ecom Express merger landing page with the Better Together headline and a Continue to Delhivery link to https://www.delhivery.com/. Verified that https://www.ecomexpress.in/robots.txt and https://www.ecomexpress.in/sitemap.xml also mis-served that same landing page instead of crawlable robots or sitemap content. There is no trustworthy public jobs surface on the first-party Ecom Express domain.'

export const ECOM_EXPRESS_CATALOG = {
  source: 'ecomexpress',
  companyName: 'Ecom Express',
  officialBrandName: 'Ecom Express',
  adapter: 'script',
  homepageUrl: 'https://www.ecomexpress.in/',
  companyCareerPage: 'https://www.ecomexpress.in/careers/',
  careerPageUrl: 'https://www.ecomexpress.in/careers/',
  checkedLandingPageUrls: [
    'https://www.ecomexpress.in/',
    'https://www.ecomexpress.in/careers/',
    'https://www.ecomexpress.in/jobs/',
    'https://www.ecomexpress.in/career/',
    'https://www.ecomexpress.in/work-with-us/',
  ],
  robotsTxtUrl: 'https://www.ecomexpress.in/robots.txt',
  sitemapUrl: 'https://www.ecomexpress.in/sitemap.xml',
  delhiveryContinueUrl: 'https://www.delhivery.com/',
  companyDomain: 'ecomexpress.in',
  atsPlatform: 'official-company-site-no-public-jobs',
  countryFilter: 'India',
  paginationStrategy: 'static-landing-page-validation-across-common-careers-routes',
  extractionStrategy:
    'verified-merger-landing-page+verified-common-careers-routes+verified-robots-and-sitemap-misserve+return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'ecomexpress/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default ECOM_EXPRESS_CATALOG
