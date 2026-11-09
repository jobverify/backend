import { createFailClosedSentinelScraper } from './failClosedSentinel.js'

export const SOURCE = 'nectarbits'
export const COMPANY = 'Nectarbits'
export const OFFICIAL_BRAND = 'NectarBits'
export const CAREERS_URL = 'https://nectarbits.com/'
export const DISPOSITION = 'verified-exact-name-public-surface-fail-closed'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 25, 2026 that https://nectarbits.com/ was the live exact-name NectarBits public company surface reviewed for Nectarbits. Local repo evidence does not establish a stable enumerable first-party jobs contract, so this company-specific scraper remains fail-closed and returns no jobs until a trustworthy public openings flow is verified.'

// Local repo evidence only confirms the exact-name public company surface, not
// a stable enumerable jobs contract, so Nectarbits remains intentionally empty.
export const run = async () => createFailClosedSentinelScraper().run()
