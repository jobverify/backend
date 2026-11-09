import { createFailClosedSentinelScraper } from './failClosedSentinel.js'

export const SOURCE = 'workindia'
export const COMPANY = 'WorkIndia'
export const OFFICIAL_BRAND = 'WorkIndia'
export const CAREERS_URL = 'https://www.workindia.in/'
export const DISPOSITION = 'verified-exact-name-public-surface-fail-closed'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 25, 2026 that https://www.workindia.in/ was the live official public surface reviewed for WorkIndia. The verified public surface presents WorkIndia as a broad job marketplace with public city and job-detail pages rather than a trustworthy exact-company careers contract for WorkIndia itself, and the reviewed surface does not establish a stable enumerable public jobs contract, so this company-specific scraper remains fail-closed and returns no jobs until a trustworthy official openings flow is verified.'

// The verified official surface establishes a public marketplace presence, not
// a trustworthy exact-company openings contract for WorkIndia itself.
export const run = async () => createFailClosedSentinelScraper().run()
