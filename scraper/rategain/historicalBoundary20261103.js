import { createFailClosedSentinelScraper } from './failClosedSentinel.js'

export const SOURCE = 'rategain'
export const COMPANY = 'Rategain'
export const OFFICIAL_BRAND = 'RateGain'
export const CAREERS_URL = 'https://rategain.com/'
export const DISPOSITION = 'verified-exact-name-public-surface-fail-closed'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 25, 2026 that https://rategain.com/ was the live exact-name RateGain public company surface reviewed for Rategain. Local repo evidence does not establish a stable enumerable public jobs contract, so this company-specific scraper remains fail-closed and returns no jobs until a trustworthy public openings flow is verified.'

// Local repo evidence only pins the exact-name RateGain public company
// surface, not a stable enumerable jobs contract, so this provider stays empty.
export const run = async () => createFailClosedSentinelScraper().run()
