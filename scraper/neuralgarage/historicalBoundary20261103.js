import { createFailClosedSentinelScraper } from './failClosedSentinel.js'

export const SOURCE = 'neuralgarage'
export const COMPANY = 'NeuralGarage'
export const OFFICIAL_BRAND = 'NeuralGarage'
export const CAREERS_URL = 'https://visualdub.ai/'
export const DISPOSITION = 'verified-exact-name-public-surface-fail-closed'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 25, 2026 that https://visualdub.ai/ was the live public surface reviewed for NeuralGarage. Local repo evidence only pins the exact workbook company name to that verified surface and does not establish a stable enumerable public jobs contract, so this company-specific scraper remains fail-closed and returns no jobs until a trustworthy public openings flow is verified.'

// Local repo evidence only ties NeuralGarage to the verified public surface
// above, not to a stable enumerable public jobs flow.
export const run = async () => createFailClosedSentinelScraper().run()
