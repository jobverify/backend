import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const KARNIVAL_CATALOG = {
  source: 'karnival',
  companyName: 'Karnival',
  officialBrandName: 'Karnival',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  companyCareerPage: 'https://www.karnival.com/',
  homepageUrl: 'https://www.karnival.com/',
  sitemapUrl: 'https://karnival.com/sitemap.xml',
  missingJobsRouteUrls: [
    'https://karnival.com/careers',
    'https://karnival.com/jobs',
  ],
  companyDomain: 'karnival.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-sitemap-without-careers-routes-plus-missing-route-validation',
  extractionStrategy:
    'verified-homepage-navigation+verified-sitemap-without-careers-or-jobs-routes+verified-careers-and-jobs-404',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  dryRunFile: 'karnival/jobs.json',
  verifiedOn: '2026-08-15',
  verifiedSurfaceSummary:
    'Verified on Saturday, August 15, 2026 that the official Karnival homepage at https://www.karnival.com/ remains a marketing site with navigation for Solutions, Success, Resources, and Contact us plus a Get a demo CTA, while the public sitemap at https://karnival.com/sitemap.xml includes additional non-jobs URLs such as DPA and blog pages but still includes no careers or jobs routes. Also verified that https://karnival.com/careers and https://karnival.com/jobs return the same first-party 404 shell. There is no trustworthy public jobs surface to scrape.',
}

export default KARNIVAL_CATALOG
