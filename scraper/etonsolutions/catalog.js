import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that the exact-name first-party homepage at https://etonsolutions.com/ is live for ETON Solutions, that the homepage publishes company links such as https://www.etonsolutions.com/about-us and https://www.etonsolutions.com/contact-us but no trustworthy public careers or ATS href, that https://etonsolutions.com/robots.txt and https://etonsolutions.com/wp-sitemap.xml both returned 404, and that https://etonsolutions.com/careers, https://etonsolutions.com/career, https://etonsolutions.com/jobs, https://etonsolutions.com/join-us, https://etonsolutions.com/work-with-us, and https://etonsolutions.com/openings each returned 404 during live verification. No trustworthy public jobs surface was exposed for the exact company name Eton Solutions. Canonical homepage: https://etonsolutions.com/'

export const ETON_SOLUTIONS_CATALOG = {
  source: 'etonsolutions',
  companyName: 'Eton Solutions',
  officialBrandName: 'ETON Solutions',
  adapter: 'script',
  homepageUrl: 'https://etonsolutions.com/',
  companyCareerPage: 'https://etonsolutions.com/careers',
  careerPageUrl: 'https://etonsolutions.com/careers',
  robotsTxtUrl: 'https://etonsolutions.com/robots.txt',
  wpSitemapUrl: 'https://etonsolutions.com/wp-sitemap.xml',
  checked404RouteUrls: [
    'https://etonsolutions.com/careers',
    'https://etonsolutions.com/career',
    'https://etonsolutions.com/jobs',
    'https://etonsolutions.com/join-us',
    'https://etonsolutions.com/work-with-us',
    'https://etonsolutions.com/openings',
  ],
  companyDomain: 'etonsolutions.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'validated-homepage-plus-missing-robots-and-wp-sitemap-plus-common-404-careers-routes',
  extractionStrategy:
    'verified-homepage-without-careers-hrefs+verified-missing-robots-and-wp-sitemap+verified-common-careers-routes-return-404+return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'etonsolutions/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default ETON_SOLUTIONS_CATALOG
