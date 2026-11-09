import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const DATAFLOW_GROUP_CATALOG = {
  source: 'dataflowgroup',
  companyName: 'Dataflow Group',
  officialBrandName: 'DATAFLOW',
  adapter: 'script',
  companyCareerPage: 'https://dataflowgroup.com/careers/',
  allVacanciesUrl: 'https://dataflowgroup.com/all-vacancies/',
  darwinboxIframeUrl: 'https://dataflowgroup.darwinbox.in/ms/candidate/careers',
  companyDomain: 'dataflowgroup.com',
  atsPlatform: 'first-party-careers-page-blocked-darwinbox-handoff',
  countryFilter: 'India',
  paginationStrategy: 'first-party-handoff-validation-only',
  extractionStrategy: 'verified-first-party-careers-page+iframe-handoff+blocked-public-darwinbox-surface-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://dataflowgroup.com/careers/ is the live first-party careers page for DATAFLOW, that it presents the EXPLORE ALL VACANCIES handoff to https://dataflowgroup.com/all-vacancies/ and embeds the official Darwinbox iframe rooted at https://dataflowgroup.darwinbox.in/ms/candidate/careers, and that the direct Darwinbox surface is blocked by Cloudflare from our environment, so the company is handled as a fail-closed local provider.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'dataflowgroup/jobs.json',
}

export default DATAFLOW_GROUP_CATALOG
