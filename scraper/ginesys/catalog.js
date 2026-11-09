import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const GINESYS_CATALOG = {
  source: 'ginesys',
  companyName: 'Ginesys',
  officialBrandName: 'Ginesys',
  adapter: 'script',
  companyCareerPage: 'https://www.ginesys.in/careers',
  officialCareersPageUrl: 'https://www.ginesys.in/careers',
  openPositionsUrl: 'https://www.ginesys.in/open-positions',
  externalHandoffUrl: 'https://ginesysone.keka.com/careers/',
  expectedIdentifier: '81ab5744-744b-438a-8efe-4fbde810ebaa',
  companyDomain: 'ginesys.in',
  atsPlatform: 'keka-embed-api',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-shell-plus-single-keka-active-jobs-endpoint',
  extractionStrategy:
    'verified-first-party-careers-shell+open-positions-keka-handoff+careerportalinfo+active-keka-embed-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.ginesys.in/careers is the first-party Ginesys careers shell, that https://www.ginesys.in/open-positions embeds the Keka handoff identifier 81ab5744-744b-438a-8efe-4fbde810ebaa for https://ginesysone.keka.com/careers/, and that the Keka active jobs endpoint returned live India roles including Executive - Talent Acquisition, Cloud Architect, Cloud Infrastructure Executive, Sales Manager, and Senior Product Manager.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'ginesys/jobs.json',
}

export default GINESYS_CATALOG
