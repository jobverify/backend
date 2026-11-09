import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that the live public JPMorganChase careers handoff still starts at ' +
  'https://www.jpmorganchase.com/careers with the title "Careers | JPMorganChase" and the same ' +
  'official Oracle Cloud Candidate Experience entrypoint used by the verified Chase India scraper. ' +
  'The public India listings continue to flow through the CX_1001 Oracle surface on jpmc.fa.oraclecloud.com.'

export const JPMORGAN_CHASE_CATALOG = {
  source: 'jpmorganchase',
  companyName: 'JPMorgan Chase',
  officialBrandName: 'Chase India',
  adapter: 'script',
  dryRunFile: 'jpmorganchase/jobs.json',
  companyCareerPage: 'https://www.jpmorganchase.com/careers',
  officialCandidateExperienceUrl:
    'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/requisitions',
  workspaceDomain: 'jpmc.fa.oraclecloud.com',
  atsPlatform: 'oracle-cloud',
  countryFilter: 'India',
  paginationStrategy: 'offset-query',
  extractionStrategy:
    'verified-jpmorganchase-careers-page+verified-official-careers-pages+oracle-cloud-finder-api+oracle-cloud-detail-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'jpmorganchase.com',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  modulePath: path.join(currentDir, 'script.js'),
}

export default JPMORGAN_CHASE_CATALOG
