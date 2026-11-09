import { createFailClosedSentinelScraper } from './failClosedSentinel.js'

export const SOURCE = 'simpliwork'
export const COMPANY = 'Simpliwork'
export const OFFICIAL_BRAND = 'Simpliwork'
export const CAREERS_URL = 'https://simpliwork.com/'
export const DISPOSITION = 'verified-exact-name-public-surface-fail-closed'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 25, 2026 that https://simpliwork.com/ was the live exact-name Simpliwork public company surface reviewed for Simpliwork. Local repo evidence does not establish a stable enumerable first-party jobs contract, so this company-specific scraper remains fail-closed and returns no jobs until a trustworthy public openings flow is verified.'

// Local repo evidence only confirms the exact-name Simpliwork public company
// surface, not a stable enumerable jobs contract, so this provider stays empty.
export const run = async () => createFailClosedSentinelScraper().run()
