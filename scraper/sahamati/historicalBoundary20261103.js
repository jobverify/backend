import { createFailClosedSentinelScraper } from './failClosedSentinel.js'

export const SOURCE = 'sahamati'
export const COMPANY = 'Sahamati'
export const OFFICIAL_BRAND = 'Sahamati'
export const CAREERS_URL = 'https://sahamati.org.in/aboutus/'
export const DISPOSITION = 'verified-public-surface-fail-closed-sentinel'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 25, 2026 that https://sahamati.org.in/aboutus/ was the live first-party public surface reviewed for Sahamati. This batch only pins the exact workbook name to the verified public company surface, and no batch-04 company-specific openings parser has been promoted yet, so the provider remains fail-closed and returns no jobs until a verifiable public openings flow is implemented.'

// Local repo evidence only pins the workbook company name to the verified
// public company surface above, not to a trustworthy enumerable jobs contract.
export const run = async () => createFailClosedSentinelScraper().run()
