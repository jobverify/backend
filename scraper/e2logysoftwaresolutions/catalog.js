import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const E2LOGY_SOFTWARE_SOLUTIONS_CATALOG = {
  source: 'e2logysoftwaresolutions',
  companyName: 'E2logy Software Solutions',
  officialBrandName: 'E2logy Software Solutions',
  adapter: 'script',
  homepageUrl: 'https://e2logy.com/',
  companyCareerPage: 'https://e2logy.com/careers',
  companyDomain: 'e2logy.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-empty-state-or-embedded-zoho-api',
  extractionStrategy: 'verified-first-party-careers-empty-state+legacy-zoho-only-when-embedded',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-08',
  verifiedSurfaceSummary:
    "Verified on October 8, 2026 that https://e2logy.com/careers is the redesigned first-party E2logy careers page. Its public Open positions section explicitly says No current openings and all roles are filled, with a general careers@e2logy.com resume handoff. The former rec_embed_js Zoho widget and https://e2logy.zohorecruit.com handoff are absent. The historical detached Zoho API also reports zero rows, so it is consumed only if a verified first-party widget handoff is restored.",
  dryRunFile: 'e2logysoftwaresolutions/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default E2LOGY_SOFTWARE_SOLUTIONS_CATALOG
