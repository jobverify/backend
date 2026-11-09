import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const DATADOG_CATALOG = {
  source: 'datadog',
  companyName: 'Datadog',
  adapter: 'script',
  companyCareerPage: 'https://careers.datadoghq.com/all-jobs/',
  companyDomain: 'careers.datadoghq.com',
  atsPlatform: 'typesense-public-search',
  countryFilter: 'India',
  paginationStrategy: 'paged-public-typesense-search-api',
  extractionStrategy: 'official-careers-html+official-main-bundle+public-typesense-documents-search',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  queryBy: 'title',
  filterBy: 'location_string:India',
  typesenseHost: 'https://gk6e3zbyuntvc5dap.a1.typesense.net',
  typesenseCollection: 'careers_alias',
  typesensePublicKey: '1Hwq7hntXp211hKvRS3CSI2QSU7w2gFm',
  jobsPerPage: 10,
  verifiedOn: '2026-07-14',
  verifiedSurfaceSummary:
    'The official Datadog careers site serves a first-party all-jobs search page whose main bundle publishes a public Typesense host, collection, and public key, and that search backend currently returns India roles from the same official careers surface.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default DATADOG_CATALOG
