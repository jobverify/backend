import path from 'node:path'
import { fileURLToPath } from 'node:url'
const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const TURTLEMINT_CATALOG = {
  source: 'turtlemint', companyName: 'Turtlemint', officialBrandName: 'Turtlemint Fintech Solutions Limited',
  exactCompanyMatchOnly: true, adapter: 'script', modulePath: path.resolve(currentDir, 'script.js'), dryRunFile: 'turtlemint/jobs.json',
  companyCareerPage: 'https://www.turtlemint.com/careers/', officialCareersPageUrl: 'https://www.turtlemint.com/careers/', companyDomain: 'turtlemint.com',
  atsPlatform: 'official-first-party-careers-no-active-openings', countryFilter: 'India', parser: 'custom-script', normalizationProfile: 'engineering-default',
  paginationStrategy: 'live-first-party-closed-visible-explicit-empty-module',
  extractionStrategy: 'fresh-first-party-careers-empty-state+closed-active-employer-module+email-only-recruiting-contact+reject-new-native-handoffs',
  inventoryVerificationPolicy: 'live-parser-evidence-required', verifiedOn: '2026-10-23', verifiedPublicJobCount: 0, verifiedIndiaJobCount: 0,
  verifiedSurfaceSummary: 'Verified on 2026-10-23 that https://www.turtlemint.com/careers/ explicitly states There are no active openings at the moment in a closed visible employer careers module, offering only careers@turtlemint.com. Every run checks current HTTP/final URL, canonical and native WebPage identity, complete HTML and careers module, active empty text and unchanged email-only contact. Hidden, inert or content-visibility-hidden empty messages cannot certify zero. New job content, native JobPosting, recruiting CTAs including opaque providers and metadata, forms/inputs/iframes or unreviewed client resources fail closed. Verification is current-run evidence, with bounded aggregate cancellation and no import side effects.',
}
export default TURTLEMINT_CATALOG
