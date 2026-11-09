import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Monday, August 3, 2026 that https://loco.com/ is still the live exact-name Loco homepage, now rendered as a thinner branded app shell, that https://www.loco.gg/ redirects to https://loco.com/, and that the first-party legal page at https://loco.com/legal/termsOfUse/terms-en.html still identifies the company as Loco Streaming Ltd. Common exact-name routes https://loco.com/about, https://loco.com/company, https://loco.com/careers, and https://loco.com/jobs all returned 404 responses during verification. There is no trustworthy public jobs surface on the exact-name Loco domain, so the provider is pinned as a fail-closed sentinel that returns no jobs.'

export const LOCO_CATALOG = {
  source: 'loco',
  companyName: 'Loco',
  officialBrandName: 'Loco Streaming Ltd',
  adapter: 'script',
  homepageUrl: 'https://loco.com/',
  legacyHomepageUrl: 'https://www.loco.gg/',
  companyCareerPage: 'https://loco.com/',
  termsOfUseUrl: 'https://loco.com/legal/termsOfUse/terms-en.html',
  companyDomain: 'loco.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-legal-page-plus-common-route-404-validation',
  extractionStrategy: 'verified-exact-name-homepage+verified-legal-company-surface+verified-missing-common-job-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-03',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'loco/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default LOCO_CATALOG
