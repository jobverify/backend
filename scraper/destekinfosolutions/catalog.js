import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, August 1, 2026 that https://desteksolutions.com/ is the live Destek Infosolutions first-party SPA homepage, that the homepage loads the first-party bundle https://desteksolutions.com/main.js containing official company copy and contact information, that the rendered homepage exposes no careers or jobs links, and that https://desteksolutions.com/contact, https://desteksolutions.com/careers, https://desteksolutions.com/career, https://desteksolutions.com/jobs, https://desteksolutions.com/job, https://desteksolutions.com/join-us, https://desteksolutions.com/openings, https://desteksolutions.com/current-openings, https://desteksolutions.com/work-with-us, https://desteksolutions.com/robots.txt, and https://desteksolutions.com/sitemap.xml all returned first-party 404 pages during live checks. No trustworthy public jobs surface is currently exposed.'

export const DESTEK_INFOSOLUTIONS_CATALOG = {
  source: 'destekinfosolutions',
  companyName: 'Destek Infosolutions',
  officialBrandName: 'Destek Infosolutions',
  adapter: 'script',
  homepageUrl: 'https://desteksolutions.com/',
  companyCareerPage: 'https://desteksolutions.com/careers',
  contactPageUrl: 'https://desteksolutions.com/',
  appBundleUrl: 'https://desteksolutions.com/main.js',
  robotsTxtUrl: 'https://desteksolutions.com/robots.txt',
  sitemapUrl: 'https://desteksolutions.com/sitemap.xml',
  companyDomain: 'desteksolutions.com',
  atsPlatform: 'official-company-site-spa-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-spa-shell-plus-app-bundle-plus-common-missing-routes-validation',
  extractionStrategy: 'verified-homepage-spa-shell+verified-app-bundle+verified-missing-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-01',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'destekinfosolutions/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default DESTEK_INFOSOLUTIONS_CATALOG
