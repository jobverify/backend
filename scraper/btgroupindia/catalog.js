import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://www.bt.com/about is the live BT corporate careers handoff page, that it links directly to the first-party BT careers site at https://jobs.bt.com/, that the live India search surface is https://jobs.bt.com/search/?createNewAlert=false&q=&locationsearch=India, that https://jobs.bt.com/sitemap.xml exposes public BT job URLs, and that https://jobs.bt.com/sitemap_index.xml currently serves a first-party RSS-style jobs feed containing 26 India jobs including https://jobs.bt.com/BT/job/Bengaluru-Software-Engineering-Professional-560103/1366481557/.'

export const BT_GROUP_INDIA_CATALOG = {
  source: 'btgroupindia',
  companyName: 'BT Group India',
  officialBrandName: 'BT Group plc',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'btgroupindia/jobs.json',
  homepageUrl: 'https://www.bt.com/',
  corporateAboutUrl: 'https://www.bt.com/about',
  companyCareerPage: 'https://jobs.bt.com/',
  indiaSearchUrl: 'https://jobs.bt.com/search/?createNewAlert=false&q=&locationsearch=India',
  sitemapUrl: 'https://jobs.bt.com/sitemap.xml',
  jobsFeedUrl: 'https://jobs.bt.com/sitemap_index.xml',
  verifiedIndiaJobUrl:
    'https://jobs.bt.com/BT/job/Bengaluru-Software-Engineering-Professional-560103/1366481557/',
  companyDomain: 'jobs.bt.com',
  atsPlatform: 'first-party-rss-jobs-feed',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-rss-feed-page',
  extractionStrategy:
    'verified-bt-about-careers-handoff+verified-jobs-bt-india-search+first-party-rss-feed+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default BT_GROUP_INDIA_CATALOG
