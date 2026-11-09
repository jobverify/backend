import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HIVER_CATALOG = {
  source: 'hiver',
  companyName: 'Hiver',
  officialBrandName: 'Hiver',
  adapter: 'script',
  companyCareerPage: 'https://hiverhq.com/careers',
  officialPinpointBoardUrl: 'https://hiverhq.pinpointhq.com/',
  pinpointPostingsUrl: 'https://hiverhq.pinpointhq.com/postings.json',
  pinpointRssUrl: 'https://hiverhq.pinpointhq.com/jobs.rss',
  companyDomain: 'hiverhq.com',
  atsPlatform: 'pinpointhq',
  countryFilter: 'India',
  paginationStrategy: 'verified-empty-first-party-careers-page',
  extractionStrategy:
    'verified-first-party-careers-page+verified-pinpoint-empty-board-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that https://hiverhq.com/careers is the live first-party Hiver careers page, that it links directly to https://hiverhq.pinpointhq.com/, and that the first-party page itself repeated No open positions currently while pointing applicants to jobs@hiverhq.com. Verified that the public Pinpoint board at https://hiverhq.pinpointhq.com/ still showed Current Opportunities with There are currently no positions advertised and only Register Your Interest, so the trustworthy public result is currently empty.',
  dryRunFile: 'hiver/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default HIVER_CATALOG
