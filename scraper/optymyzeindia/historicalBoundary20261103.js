import { createFailClosedSentinelScraper } from './failClosedSentinel.js'

export const SOURCE = 'optymyzeindia'
export const COMPANY = 'Optymyze India'
export const OFFICIAL_BRAND = 'Optymyze'
export const CAREERS_URL = 'https://optymyze.com/'
export const DISPOSITION = 'verified-exact-name-public-surface-fail-closed'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 25, 2026 that https://optymyze.com/ was the live exact-name Optymyze public company surface reviewed for Optymyze India. Local repo evidence does not establish a stable enumerable first-party jobs contract, so this company-specific scraper remains fail-closed and returns no jobs until a trustworthy public openings flow is verified.'

// Local repo evidence only confirms the Optymyze public company surface, not a
// stable enumerable jobs contract for the workbook company.
export const run = async () => createFailClosedSentinelScraper().run()
