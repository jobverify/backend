import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://www.dropbox.com/jobs redirects to Dropbox\'s live first-party careers site at https://www.dropbox.jobs/en/, that the public jobs listing lives at https://www.dropbox.jobs/en/jobs/ and displayed 39 matching jobs during verification, and that https://www.dropbox.jobs/robots.txt advertises the first-party sitemap at https://www.dropbox.jobs/sitemap.xml, which publishes the canonical English job detail URLs including https://www.dropbox.jobs/en/jobs/8053628/data-engineer/.'

export const DROPBOX_CATALOG = {
  source: 'dropbox',
  companyName: 'Dropbox',
  officialBrandName: 'Dropbox',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'dropbox/jobs.json',
  companyCareerPage: 'https://www.dropbox.com/jobs',
  companyDomain: 'dropbox.jobs',
  officialHomepageUrl: 'https://www.dropbox.com/',
  officialCareersHomeUrl: 'https://www.dropbox.jobs/en/',
  officialJobsListingUrl: 'https://www.dropbox.jobs/en/jobs/',
  robotsTxtUrl: 'https://www.dropbox.jobs/robots.txt',
  sitemapUrl: 'https://www.dropbox.jobs/sitemap.xml',
  verifiedListingJobCount: 39,
  verifiedSampleJobUrl: 'https://www.dropbox.jobs/en/jobs/8053628/data-engineer/',
  atsPlatform: 'official-company-careers-sitemap',
  countryFilter: 'Global',
  paginationStrategy: 'first-party-robots-plus-sitemap-job-detail-url-discovery',
  extractionStrategy:
    'verified-careers-redirect+verified-jobs-listing+robots-advertised-sitemap+english-job-detail-urls',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default DROPBOX_CATALOG
