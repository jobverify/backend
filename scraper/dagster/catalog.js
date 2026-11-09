import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, August 15, 2026 that https://dagster.io/ remains the live Dagster homepage, that it now presents the AI-native DataOps marketing copy beginning with "Data your team trusts. AI that runs on it.", that https://dagster.io/company/careers still redirects to https://www.prefect.io/careers instead of an exact-name Dagster jobs page, and that the exact-name public Greenhouse board at https://job-boards.greenhouse.io/dagsterlabs still states "There are no current openings." This provider therefore treats the current Dagster surface as an honest empty sentinel until a trustworthy exact-name jobs surface reappears.'

export const DAGSTER_CATALOG = {
  source: 'dagster',
  companyName: 'Dagster',
  officialBrandName: 'Dagster Labs',
  adapter: 'script',
  homepageUrl: 'https://dagster.io/',
  companyCareerPage: 'https://dagster.io/company/careers',
  greenhouseBoardUrl: 'https://job-boards.greenhouse.io/dagsterlabs',
  companyDomain: 'dagster.io',
  verifiedPublicJobCount: 0,
  verifiedIndiaJobCount: 0,
  atsPlatform: 'dagster-homepage-plus-empty-greenhouse-board',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-prefect-redirect-plus-empty-greenhouse-board',
  extractionStrategy:
    'verified-homepage-plus-prefect-careers-redirect-plus-empty-greenhouse-board-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  dryRunFile: 'dagster/jobs.json',
  verifiedOn: '2026-08-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default DAGSTER_CATALOG
