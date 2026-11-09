import { createFailClosedSentinelScraper } from './failClosedSentinel.js'

export const SOURCE = 'paramai'
export const COMPANY = 'Param.ai'
export const OFFICIAL_BRAND = 'Param.ai'
export const CAREERS_URL = 'https://param.ai/'
export const DISPOSITION = 'verified-exact-name-public-surface-fail-closed'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 25, 2026 that https://param.ai/ was the live exact-name Param.ai public company surface reviewed for Param.ai. Local repo evidence does not establish a stable enumerable first-party jobs contract, so this company-specific scraper remains fail-closed and returns no jobs until a trustworthy public openings flow is verified.'

// Local repo evidence only confirms the exact-name Param.ai public company
// surface, not a stable enumerable jobs contract, so this provider stays empty.
export const run = async () => createFailClosedSentinelScraper().run()
