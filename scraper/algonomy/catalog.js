import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PAYCOR_CLIENT_ID = '8a7883c6606d030901607ae3719c71a6'

export const ALGONOMY_CATALOG = {
  source: 'algonomy',
  companyName: 'Algonomy',
  officialBrandName: 'Algonomy',
  adapter: 'script',
  companyCareerPage: 'https://algonomy.com/careers/',
  paycorClientId: PAYCOR_CLIENT_ID,
  paycorScriptUrl: `https://recruitingbypaycor.com/career/iframe.action?clientId=${PAYCOR_CLIENT_ID}`,
  paycorBoardUrl: `https://recruitingbypaycor.com/career/CareerHome.action?clientId=${PAYCOR_CLIENT_ID}&parentUrl=https://algonomy.com/careers/`,
  companyDomain: 'algonomy.com',
  atsPlatform: 'official-careers-migration-unverified-scope',
  countryFilter: 'Global',
  paginationStrategy: 'unavailable-until-algonomy-scope-is-verified',
  extractionStrategy: 'reject-parent-company-migration-without-verified-algonomy-inventory',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-09-13',
  verifiedPublicJobCount: null,
  verifiedSurfaceSummary:
    'Verified on September 13, 2026 that https://algonomy.com/careers/ redirects to https://adaglobal.com/careers/, whose official jobs handoff is https://adaglobal.darwinbox.com/ms/candidatev2/main/careers/allJobs. The public inventory API returned Cloudflare HTTP 403 during verification. An Algonomy-specific inventory cannot be established from this shared parent-company board; the migrated surface rejects the snapshot. An unlinked legacy Paycor board is not trusted.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default ALGONOMY_CATALOG
