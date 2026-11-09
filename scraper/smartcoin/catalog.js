import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, July 17, 2026 that https://www.olyv.co.in/about-us is the live Olyv About Us page for SmartCoin Financials Pvt. Ltd., that it links candidates to https://smartcoin.keka.com/careers via Jobs, and that the page still carries SmartCoin contact and footer identity markers. There is no trustworthy public jobs surface for the exact-name SmartCoin row right now because the live Keka careers root did not expose a trustworthy enumerable public jobs board from browser probes on the verified date, so this provider fails closed and returns no jobs until Olyv or SmartCoin exposes a stable verifiable public listings contract again.'

export const SMARTCOIN_CATALOG = {
  source: 'smartcoin',
  companyName: 'SmartCoin',
  officialBrandName: 'SmartCoin Financials Pvt. Ltd.',
  adapter: 'script',
  companyCareerPage: 'https://www.olyv.co.in/about-us',
  officialCareersPageUrl: 'https://www.olyv.co.in/about-us',
  officialCareersHandoffUrl: 'https://smartcoin.keka.com/careers',
  companyDomain: 'olyv.co.in',
  atsPlatform: 'keka-handoff-unverifiable',
  countryFilter: 'India',
  paginationStrategy: 'official-about-page-plus-external-keka-handoff-no-verifiable-public-board',
  extractionStrategy: 'verified-first-party-about-page+verified-keka-handoff+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'smartcoin/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SMARTCOIN_CATALOG
