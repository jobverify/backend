import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ENCOMPASS_CATALOG = {
  source: 'encompass',
  companyName: 'Encompass',
  officialBrandName: 'Encompass Corporation',
  adapter: 'script',
  homepageUrl: 'https://www.encompasscorporation.com/',
  companyCareerPage: 'https://www.encompasscorporation.com/careers/',
  careersEntryUrl: 'https://www.encompasscorporation.com/careers',
  careersPageUrl: 'https://www.encompasscorporation.com/careers/',
  officialPinpointBoardUrl: 'https://encompass.pinpointhq.com/',
  pinpointPostingsUrl: 'https://encompass.pinpointhq.com/postings.json',
  pinpointRssUrl: 'https://encompass.pinpointhq.com/jobs.rss',
  verifiedFirstPartyUrls: [
    'https://www.encompasscorporation.com/',
    'https://www.encompasscorporation.com/careers',
    'https://www.encompasscorporation.com/careers/',
  ],
  linkedCareerUrls: [
    'https://encompass.pinpointhq.com/#js-careers-jobs-block',
    'https://encompass.pinpointhq.com/',
    'https://encompass.pinpointhq.com/postings.json',
    'https://encompass.pinpointhq.com/jobs.rss',
  ],
  companyDomain: 'encompasscorporation.com',
  atsPlatform: 'pinpointhq',
  countryFilter: 'India',
  paginationStrategy: 'pinpoint-postings-json',
  extractionStrategy:
    'verified-homepage+verified-careers-page+verified-pinpoint-board+verified-pinpoint-postings-json+india-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://www.encompasscorporation.com/ is the live first-party Encompass Corporation homepage, that https://www.encompasscorporation.com/careers/ is the live first-party careers page and hands candidates to https://encompass.pinpointhq.com/#js-careers-jobs-block, and that the public Pinpoint board at https://encompass.pinpointhq.com/ advertises both https://encompass.pinpointhq.com/postings.json and https://encompass.pinpointhq.com/jobs.rss. During verification, the postings feed exposed a Senior Platform Engineer role in Glasgow with no current India listings, so the honest India-only result is currently empty.',
  dryRunFile: 'encompass/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default ENCOMPASS_CATALOG
