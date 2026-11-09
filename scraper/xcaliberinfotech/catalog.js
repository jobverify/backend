import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const XCALIBER_INFOTECH_CATALOG = {
  source: 'xcaliberinfotech',
  companyName: 'Xcaliber Infotech',
  officialBrandName: 'Xcaliber Infotech Pvt. Ltd.',
  adapter: 'script',
  homepageUrl: 'https://xcaliberinfotech.com/',
  companyCareerPage: 'https://xcaliberinfotech.com/search-jobs/',
  companyDomain: 'xcaliberinfotech.com',
  atsPlatform: 'sucuri-blocked-first-party-careers-shell',
  countryFilter: 'India',
  paginationStrategy: 'fail-closed-sucuri-interstitial',
  extractionStrategy:
    'verified-direct-fetch-sucuri-interstitial+browser-visible-empty-careers-shell+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that the first-party route https://xcaliberinfotech.com/search-jobs/ rendered a browser-visible "Search For Open Positions" shell but did not expose trustworthy public job cards, and that direct fetches to the same first-party route returned a Sucuri interstitial titled "You are being redirected..." with the message "Javascript is required. Please enable javascript before you are allowed to see this page." Because the verified first-party careers surface is blocked and no trustworthy public jobs feed was accessible, this local provider intentionally fails closed and returns an empty array until Xcaliber Infotech publishes an accessible public board.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default XCALIBER_INFOTECH_CATALOG
