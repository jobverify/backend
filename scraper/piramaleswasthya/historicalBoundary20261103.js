import { createFailClosedSentinelScraper } from './failClosedSentinel.js'

export const SOURCE = 'piramaleswasthya'
export const COMPANY = 'Piramal eSwasthya'
export const OFFICIAL_BRAND = 'Piramal Swasthya'
export const CAREERS_URL = 'https://www.piramalswasthya.org/'
export const DISPOSITION = 'verified-exact-name-public-surface-fail-closed'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 25, 2026 that https://www.piramalswasthya.org/ was the live exact-name Piramal Swasthya public company surface reviewed for Piramal eSwasthya. Local repo evidence does not establish a stable enumerable first-party jobs contract, so this company-specific scraper remains fail-closed and returns no jobs until a trustworthy public openings flow is verified.'

// Local repo evidence only confirms the branded public company surface, not a
// stable enumerable jobs contract for the workbook entity, so this stays empty.
export const run = async () => createFailClosedSentinelScraper().run()
