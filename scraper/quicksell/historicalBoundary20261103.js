import { createFailClosedSentinelScraper } from './failClosedSentinel.js'

export const SOURCE = 'quicksell'
export const COMPANY = 'QuickSell'
export const OFFICIAL_BRAND = 'QuickSell'
export const CAREERS_URL = 'https://quicksell.co/'
export const DISPOSITION = 'verified-exact-name-public-surface-fail-closed'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 25, 2026 that https://quicksell.co/ was the live exact-name QuickSell public company surface reviewed for QuickSell. Local repo evidence does not establish a stable enumerable first-party jobs contract, so this company-specific scraper remains fail-closed and returns no jobs until a trustworthy public openings flow is verified.'

// Local repo evidence only confirms the exact-name QuickSell public company
// surface, not a stable enumerable jobs contract, so this provider stays empty.
export const run = async () => createFailClosedSentinelScraper().run()
