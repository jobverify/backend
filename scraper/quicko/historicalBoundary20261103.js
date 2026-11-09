import { createFailClosedSentinelScraper } from './failClosedSentinel.js'

export const SOURCE = 'quicko'
export const COMPANY = 'Quicko'
export const OFFICIAL_BRAND = 'Quicko'
export const CAREERS_URL = 'https://quicko.com/'
export const DISPOSITION = 'verified-exact-name-public-surface-fail-closed'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 25, 2026 that https://quicko.com/ was the live exact-name Quicko public company surface reviewed for Quicko. Local repo evidence does not establish a stable enumerable first-party jobs contract, so this company-specific scraper remains fail-closed and returns no jobs until a trustworthy public openings flow is verified.'

// Local repo evidence only confirms the exact-name Quicko public company
// surface, not a stable enumerable jobs contract, so this provider stays empty.
export const run = async () => createFailClosedSentinelScraper().run()
