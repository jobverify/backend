import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HFCL_CATALOG = {
  source: 'hfcl',
  companyName: 'HFCL',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  companyCareerPage: 'https://www.hfcl.com/company/careers',
  companyDomain: 'hfcl.com',
  atsPlatform: 'darwinbox',
  countryFilter: 'India',
  paginationStrategy: 'browser-session-darwinbox-pagination',
  extractionStrategy: 'official-careers-page+darwinbox-candidate-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  officialCareersHandoffUrl: 'https://hifi.darwinbox.in/ms/candidatev2/604761d854807/careers/home',
  darwinboxOrigin: 'https://hifi.darwinbox.in',
  darwinboxCompanyId: '604761d854807',
  dryRunFile: 'hfcl/jobs.json',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    "Verified on July 16, 2026 that https://www.hfcl.com/company/careers is HFCL's official careers page and that its Browse jobs handoff targets the public Darwinbox tenant at https://hifi.darwinbox.in/ms/candidatev2/604761d854807/careers/home.",
}

export default HFCL_CATALOG
