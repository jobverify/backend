import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AALEKH_CATALOG = {
  source: 'aalekh',
  companyName: 'Aalekh',
  officialBrandName: 'Aalekh Designs',
  adapter: 'script',
  companyCareerPage: 'https://aalekh.co/',
  companyDomain: 'aalekh.co',
  contactPageUrl: 'https://aalekh.co/contactUs',
  robotsTxtUrl: 'https://aalekh.co/robots.txt',
  sitemapUrl: 'https://aalekh.co/sitemap.xml',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-contact-plus-common-careers-and-crawl-surface-404-validation',
  extractionStrategy: 'verified-homepage+verified-contact-page+verified-missing-robots-sitemap-and-careers-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-14',
  verifiedSurfaceSummary:
    'Verified on July 14, 2026 that https://aalekh.co/ is the live first-party marketing site for Aalekh Designs in Rajkot, Gujarat, https://aalekh.co/contactUs is the live contact page, and the site exposes no trustworthy public jobs surface. Common first-party careers routes plus robots.txt and sitemap.xml return first-party 404 pages.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default AALEKH_CATALOG
