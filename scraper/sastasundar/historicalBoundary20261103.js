import { createFailClosedSentinelScraper } from './failClosedSentinel.js'

export const SOURCE = 'sastasundar'
export const COMPANY = 'Sastasundar'
export const OFFICIAL_BRAND = 'Sastasundar'
export const CAREERS_URL = 'https://sastasundar.com/pages/view/about-us'
export const DISPOSITION = 'verified-public-surface-fail-closed-sentinel'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 25, 2026 that https://sastasundar.com/pages/view/about-us was the live first-party public surface reviewed for Sastasundar. This batch only pins the exact workbook name to the verified public company surface, and no batch-04 company-specific openings parser has been promoted yet, so the provider remains fail-closed and returns no jobs until a verifiable public openings flow is implemented.'

// Local repo evidence only confirms the verified Sastasundar public company
// surface, not a trustworthy enumerable public openings contract.
export const run = async () => createFailClosedSentinelScraper().run()
