import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const FLYWEIS_TECHNOLOGY_CATALOG = {
  source: 'flyweistechnology',
  companyName: 'Flyweis Technology',
  officialBrandName: 'Flyweis Technology',
  adapter: 'script',
  homepageUrl: 'https://www.flyweis.technology/',
  companyCareerPage: 'https://www.flyweis.technology/',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-only-validation',
  extractionStrategy: 'verified-first-party-homepage-without-public-careers-surface-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'flyweis.technology',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.flyweis.technology/ is the live first-party Flyweis Technology homepage and that its current public navigation exposes Home, About, Services, Blog, Portfolio, and Contact routes only. The page markets Flyweis services and team metrics, but it does not expose a trustworthy public careers page, public job cards, or job-specific apply routes. This provider therefore stays fail-closed.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default FLYWEIS_TECHNOLOGY_CATALOG
