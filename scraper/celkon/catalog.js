import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CELKON_CATALOG = {
  source: 'celkon',
  companyName: 'Celkon',
  adapter: 'script',
  companyCareerPage: 'https://celkongroup.com/',
  companyDomain: 'celkongroup.com',
  legacyCompanyDomain: 'celkonmobiles.com',
  legacyHomepageUrl: 'https://www.celkonmobiles.com/',
  aboutPageUrl: 'https://celkongroup.com/about-us/',
  contactPageUrl: 'https://celkongroup.com/contacts/',
  pageSitemapUrl: 'https://celkongroup.com/wp-sitemap-posts-page-1.xml',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'legacy-domain-redirect-plus-homepage-about-contact-sitemap-and-common-careers-404-validation',
  extractionStrategy: 'verified-legacy-domain-redirect+verified-homepage+verified-about+verified-contact+verified-page-sitemap-without-careers+verified-common-careers-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-14',
  verifiedSurfaceSummary:
    'Verified on July 14, 2026 that celkonmobiles.com redirects to celkongroup.com, the current first-party homepage plus /about-us/ and /contacts/ expose only corporate marketing content, the published page sitemap exposes no careers-like route, and common first-party careers URLs return stable 404 shells. No trustworthy public jobs surface was discoverable.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default CELKON_CATALOG
