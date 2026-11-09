import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://www.bata.in/ is the live official Bata India homepage and its footer Careers link hands applicants to the public SenseHQ board at https://bata.sensehq.com/careers. Verified that the root board __NEXT_DATA__ payload at https://bata.sensehq.com/careers currently exposes 10 public openings, that the first-party iframe listings payload at https://bata.sensehq.com/careers/iframe/jobs?page=1&isIframe=true exposes the remaining 5 public openings for a total of 15 public openings, and that canonical detail routes including https://bata.sensehq.com/careers/jobs/530 and https://bata.sensehq.com/careers/jobs/272 are live. The scraper therefore merges the verified root board with the verified iframe supplement and deduplicates by SenseHQ job id.'

export const BATA_INDIA_CATALOG = {
  source: 'bataindia',
  companyName: 'Bata India',
  officialBrandName: 'Bata India Limited',
  adapter: 'script',
  homepageUrl: 'https://www.bata.in/',
  companyCareerPage: 'https://bata.sensehq.com/careers',
  officialCareersHandoffUrl: 'https://bata.sensehq.com/careers',
  iframeListingsUrl: 'https://bata.sensehq.com/careers/iframe/jobs?page=1&isIframe=true',
  sampleJobUrl: 'https://bata.sensehq.com/careers/jobs/530',
  sampleIframeOnlyJobUrl: 'https://bata.sensehq.com/careers/jobs/272',
  companyDomain: 'bata.in',
  atsPlatform: 'sensehq',
  countryFilter: 'India',
  paginationStrategy: 'official-homepage-footer-handoff-plus-root-board-plus-iframe-pagination-dedupe',
  extractionStrategy:
    'verified-official-homepage-footer-handoff+verified-root-next-data+verified-iframe-next-data+canonical-detail-routes',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'bataindia/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default BATA_INDIA_CATALOG
